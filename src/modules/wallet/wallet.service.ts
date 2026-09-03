import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletValidatorService, ChainType } from './wallet-validator.service';

export interface PaystackBank {
  name: string;
  code: string;
  longcode: string;
  gateway: string;
  pay_with_bank: boolean;
  active: boolean;
  country: string;
  currency: string;
  type: string;
  id: number;
  slug: string;
}

export interface PaystackResolveResponse {
  status: boolean;
  message: string;
  data: {
    account_number: string;
    account_name: string;
    bank_id: number;
  };
}

export interface PaystackTransferRecipientResponse {
  status: boolean;
  message: string;
  data: {
    recipient_code: string;
    type: string;
    name: string;
    account_number: string;
    bank_code: string;
    bank_name: string;
    description: string;
    active: boolean;
  };
}

export interface PaystackTransferResponse {
  status: boolean;
  message: string;
  data: {
    amount: number;
    currency: string;
    source: string;
    reference: string;
    recipient: string;
    reason: string;
    transfer_code: string;
    status: string;
  };
}

@Injectable()
export class WalletService {
  private readonly logger = new Logger(WalletService.name);
  private readonly paystackSecretKey: string;
  private readonly paystackApiUrl = 'https://api.paystack.co';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly walletValidator: WalletValidatorService,
  ) {
    this.paystackSecretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    if (!this.paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not defined in environment variables');
    }
  }

  async getBanks(): Promise<PaystackBank[]> {
    try {
      const response = await firstValueFrom(
        this.httpService.get<{ status: boolean; message: string; data: PaystackBank[] }>(
          `${this.paystackApiUrl}/bank?country=nigeria&perPage=100`,
          {
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
            },
          },
        ),
      );

      if (!response.data.status) {
        throw new Error(`Paystack banks fetch failed: ${response.data.message}`);
      }

      return response.data.data;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching banks: ${err.message}`, err.stack);
      throw err;
    }
  }

  async resolveAndSaveBank(
    userId: string,
    accountNumber: string,
    bankCode: string,
  ): Promise<{
    accountName: string;
    bankName: string;
    paystackRecipientCode: string;
  }> {
    try {
      // Resolve account details with Paystack
      const resolveResponse = await firstValueFrom(
        this.httpService.get<PaystackResolveResponse>(
          `${this.paystackApiUrl}/bank/resolve?account_number=${accountNumber}&bank_code=${bankCode}`,
          {
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
            },
          },
        ),
      );

      if (!resolveResponse.data.status) {
        throw new BadRequestException(`Account resolution failed: ${resolveResponse.data.message}`);
      }

      const { account_name, bank_id } = resolveResponse.data.data;

      // Get bank name from bank code
      const banks = await this.getBanks();
      const bank = banks.find((b) => b.code === bankCode);
      const bankName = bank?.name || 'Unknown Bank';

      // Create Paystack transfer recipient
      const recipientResponse = await firstValueFrom(
        this.httpService.post<PaystackTransferRecipientResponse>(
          `${this.paystackApiUrl}/transferrecipient`,
          {
            type: 'nuban',
            name: account_name,
            account_number: accountNumber,
            bank_code: bankCode,
            currency: 'NGN',
          },
          {
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!recipientResponse.data.status) {
        throw new BadRequestException(`Recipient creation failed: ${recipientResponse.data.message}`);
      }

      const { recipient_code } = recipientResponse.data.data;

      // Check if bank account already exists for this user
      const existingBank = await this.prisma.savedBank.findFirst({
        where: {
          userId,
          accountNumber,
          bankCode,
        },
      });

      if (existingBank) {
        // Update existing record with new recipient code
        const updatedBank = await this.prisma.savedBank.update({
          where: { id: existingBank.id },
          data: {
            accountName: account_name,
            paystackRecipientCode: recipient_code,
            isVerified: true,
          },
        });

        this.logger.log(`Updated existing bank account for user ${userId}`);

        return {
          accountName: updatedBank.accountName,
          bankName: updatedBank.bankName,
          paystackRecipientCode: updatedBank.paystackRecipientCode!,
        };
      }

      // Save new bank account
      const savedBank = await this.prisma.savedBank.create({
        data: {
          userId,
          bankCode,
          bankName,
          accountNumber,
          accountName: account_name,
          paystackRecipientCode: recipient_code,
          isVerified: true,
        },
      });

      this.logger.log(`Saved new bank account for user ${userId}`);

      return {
        accountName: savedBank.accountName,
        bankName: savedBank.bankName,
        paystackRecipientCode: savedBank.paystackRecipientCode!,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error resolving and saving bank: ${err.message}`, err.stack);
      throw err;
    }
  }

  async getWalletBalance(userId: string): Promise<{
    nairaBalance: number;
    formattedBalance: string;
    savedBanks: Array<{
      id: string;
      bankName: string;
      accountNumber: string;
      accountName: string;
      isVerified: boolean;
    }>;
  }> {
    try {
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        include: {
          wallet: true,
          savedBanks: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
              isVerified: true,
            },
          },
        },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Get balance from wallet instead of user
      const numericBalance = Number(user.wallet?.nairaBalance || 0);
      const formattedBalance = this.formatNairaAmount(numericBalance);

      return {
        nairaBalance: numericBalance,
        formattedBalance,
        savedBanks: user.savedBanks,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching wallet balance: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Format numeric amount as Nigerian Naira with proper locale formatting
   */
  private formatNairaAmount(amount: number): string {
    return amount.toLocaleString('en-NG', { 
      minimumFractionDigits: 2,
      maximumFractionDigits: 2 
    });
  }

  async withdraw(
    userId: string,
    amount: number,
    bankAccountId: string,
  ): Promise<{
    success: boolean;
    message: string;
    transactionId?: string;
    reference?: string;
  }> {
    try {
      // Validate amount
      if (amount <= 0) {
        throw new BadRequestException('Amount must be greater than 0');
      }

      // Check minimum withdrawal amount (₦500)
      const MIN_WITHDRAWAL_AMOUNT = 500;
      if (amount < MIN_WITHDRAWAL_AMOUNT) {
        throw new BadRequestException(`Minimum withdrawal amount is ₦${MIN_WITHDRAWAL_AMOUNT}`);
      }

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has sufficient balance using wallet
      const walletData = await this.getWalletBalance(userId);
      const currentBalance = walletData.nairaBalance;
      const withdrawalAmount = Number(amount);
      
      if (withdrawalAmount > currentBalance) {
        throw new BadRequestException(`Insufficient balance. Your current balance is ₦${currentBalance.toLocaleString()}`);
      }

      // Get saved bank account
      const savedBank = await this.prisma.savedBank.findUnique({
        where: { id: bankAccountId },
      });

      if (!savedBank) {
        throw new NotFoundException('Bank account not found');
      }

      if (savedBank.userId !== userId) {
        throw new BadRequestException('Bank account does not belong to user');
      }

      if (!savedBank.paystackRecipientCode) {
        this.logger.error(`Bank account ${bankAccountId} has no Paystack recipient code`);
        throw new BadRequestException('Bank account is not properly configured for transfers. Please re-add your bank account.');
      }

      // Verify recipient code is valid format
      if (!savedBank.paystackRecipientCode.startsWith('RCP_')) {
        this.logger.error(`Invalid recipient code format: ${savedBank.paystackRecipientCode}`);
        throw new BadRequestException('Invalid recipient code. Please re-add your bank account.');
      }

      // Generate reference for transaction
      const reference = `WD_${userId}_${Date.now()}`;

      // Convert amount to kobo using strict numeric arithmetic
      const amountInKobo = Math.round(withdrawalAmount * 100);

      // Initiate Paystack transfer
      this.logger.log(`Initiating Paystack transfer: amount=${amountInKobo} kobo, recipient=${savedBank.paystackRecipientCode}, reference=${reference}`);
      
      let transferResponse: any;
      
      try {
        transferResponse = await firstValueFrom(
          this.httpService.post<PaystackTransferResponse>(
            `${this.paystackApiUrl}/transfer`,
            {
              source: 'balance',
              amount: amountInKobo,
              recipient: savedBank.paystackRecipientCode,
              reason: `Wallet withdrawal - ${reference}`,
              reference,
            },
            {
              headers: {
                Authorization: `Bearer ${this.paystackSecretKey}`,
                'Content-Type': 'application/json',
              },
            },
          ),
        );

        this.logger.log(`Paystack transfer response: ${JSON.stringify(transferResponse.data)}`);

        if (!transferResponse.data.status) {
          this.logger.error(`Paystack transfer failed: ${transferResponse.data.message}`);
          throw new BadRequestException(`Transfer failed: ${transferResponse.data.message}`);
        }
      } catch (axiosError) {
        const err = axiosError as any;
        this.logger.error(`Paystack API error: ${err.message}`, err.response?.data);

        // Handle specific Paystack errors
        const errorMessage = err.response?.data?.message || err.response?.data?.error || err.message;
        
        if (err.response?.status === 400) {
          // Common 400 errors - check for specific messages
          if (errorMessage.includes('balance') || errorMessage.includes('Insufficient')) {
            throw new BadRequestException('Insufficient Paystack balance. Please contact support.');
          } else if (errorMessage.includes('recipient') || errorMessage.includes('Recipient')) {
            throw new BadRequestException('Invalid recipient. Please re-add your bank account.');
          } else if (errorMessage.includes('reference') || errorMessage.includes('Reference')) {
            throw new BadRequestException('Duplicate transaction reference. Please try again.');
          } else if (errorMessage.includes('amount') || errorMessage.includes('Amount')) {
            throw new BadRequestException('Invalid amount format. Please try again.');
          }
        }
        
        throw new BadRequestException(`Transfer failed: ${errorMessage}`);
      }

      // Deduct from wallet balance using atomic transaction
      await this.deductFunds(userId, withdrawalAmount, 'WITHDRAWAL', reference, {
        bankAccountId,
        bankName: savedBank.bankName,
        accountNumber: savedBank.accountNumber,
        accountName: savedBank.accountName,
        transferCode: transferResponse?.data?.data?.transfer_code,
        transferStatus: transferResponse?.data?.data?.status,
      });

      this.logger.log(`Withdrawal of ₦${withdrawalAmount} processed for user ${userId}. Reference: ${reference}`);

      return {
        success: true,
        message: 'Withdrawal processed successfully',
        reference,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing withdrawal: ${err.message}`, err.stack);
      throw err;
    }
  }

  async addFunds(userId: string, amount: number, type: 'REFERRAL_EARNING' | 'BONUS_DEPOSIT' | 'REFUND' | 'OFFRAMP_PAYOUT' | 'GAS_PURCHASE' | 'DEPOSIT', reference: string, metadata?: any): Promise<void> {
    try {
      // Ensure strict numeric arithmetic
      const numericAmount = Number(amount);
      
      // Perform atomic transaction using Prisma interactive transaction
      await this.prisma.$transaction(async (tx) => {
        // Fetch user's wallet
        const wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (!wallet) {
          throw new NotFoundException('Wallet not found for user');
        }

        const balanceBefore = Number(wallet.nairaBalance);
        const balanceAfter = balanceBefore + numericAmount;

        this.logger.log(`Adding funds to user ${userId}: ${balanceBefore} + ${numericAmount} = ${balanceAfter}`);

        // Atomically update wallet balance
        await tx.wallet.update({
          where: { userId },
          data: {
            nairaBalance: balanceAfter,
          },
        });

        // Create wallet transaction with balance tracking
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: numericAmount,
            type,
            status: 'SUCCESS',
            balanceBefore,
            balanceAfter,
            reference,
            metadata,
          },
        });
      });

      this.logger.log(`Added ${numericAmount} NGN to user ${userId} wallet (type: ${type})`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error adding funds: ${err.message}`, err.stack);
      throw err;
    }
  }

  async deductFunds(userId: string, amount: number, type: 'WITHDRAWAL' | 'GAS_PURCHASE' | 'OFFRAMP_PAYOUT', reference: string, metadata?: any): Promise<void> {
    try {
      // Ensure strict numeric arithmetic
      const numericAmount = Number(amount);
      
      // Perform atomic transaction using Prisma interactive transaction
      await this.prisma.$transaction(async (tx) => {
        // Fetch user's wallet
        const wallet = await tx.wallet.findUnique({
          where: { userId },
        });

        if (!wallet) {
          throw new NotFoundException('Wallet not found for user');
        }

        const balanceBefore = Number(wallet.nairaBalance);

        // Check if sufficient balance
        if (balanceBefore < numericAmount) {
          throw new BadRequestException(`Insufficient balance. Current balance: ₦${balanceBefore.toLocaleString()}, Required: ₦${numericAmount.toLocaleString()}`);
        }

        const balanceAfter = balanceBefore - numericAmount;

        this.logger.log(`Deducting funds from user ${userId}: ${balanceBefore} - ${numericAmount} = ${balanceAfter}`);

        // Atomically update wallet balance
        await tx.wallet.update({
          where: { userId },
          data: {
            nairaBalance: balanceAfter,
          },
        });

        // Create wallet transaction with balance tracking
        await tx.walletTransaction.create({
          data: {
            walletId: wallet.id,
            amount: -numericAmount, // Store as negative for deductions
            type,
            status: 'SUCCESS',
            balanceBefore,
            balanceAfter,
            reference,
            metadata,
          },
        });
      });

      this.logger.log(`Deducted ${numericAmount} NGN from user ${userId} wallet (type: ${type})`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error deducting funds: ${err.message}`, err.stack);
      throw err;
    }
  }
}
