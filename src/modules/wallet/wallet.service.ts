import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { PrismaService } from '../../prisma/prisma.service';

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

      const numericBalance = Number(user.nairaBalance);
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

      // Get user
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
      });

      if (!user) {
        throw new NotFoundException('User not found');
      }

      // Check if user has sufficient balance using strict numeric arithmetic
      const currentBalance = Number(user.nairaBalance);
      const withdrawalAmount = Number(amount);
      
      if (withdrawalAmount > currentBalance) {
        throw new BadRequestException('Insufficient balance');
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
        throw new BadRequestException('Bank account is not properly configured for transfers');
      }

      // Generate reference for transaction
      const reference = `WD_${userId}_${Date.now()}`;

      // Create pending wallet transaction
      const transaction = await this.prisma.walletTransaction.create({
        data: {
          userId,
          amount,
          type: 'WITHDRAWAL',
          status: 'PENDING',
          reference,
          metadata: {
            bankAccountId,
            bankName: savedBank.bankName,
            accountNumber: savedBank.accountNumber,
          },
        },
      });

      // Convert amount to kobo using strict numeric arithmetic
      const amountInKobo = Math.round(withdrawalAmount * 100);

      // Initiate Paystack transfer
      const transferResponse = await firstValueFrom(
        this.httpService.post<PaystackTransferResponse>(
          `${this.paystackApiUrl}/transfer`,
          {
            source: 'balance',
            amount: amountInKobo,
            recipient: savedBank.paystackRecipientCode,
            reason: 'Wallet withdrawal',
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

      if (!transferResponse.data.status) {
        // Update transaction as failed
        await this.prisma.walletTransaction.update({
          where: { id: transaction.id },
          data: {
            status: 'FAILED',
            metadata: {
              ...transaction.metadata as any,
              paystackError: transferResponse.data.message,
            },
          },
        });

        throw new BadRequestException(`Transfer failed: ${transferResponse.data.message}`);
      }

      // Deduct from user balance using strict numeric arithmetic
      const newBalance = currentBalance - withdrawalAmount;
      
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          nairaBalance: newBalance,
        },
      });

      // Update transaction as successful
      await this.prisma.walletTransaction.update({
        where: { id: transaction.id },
        data: {
          status: 'SUCCESS',
          metadata: {
            ...transaction.metadata as any,
            transferCode: transferResponse.data.data.transfer_code,
            transferStatus: transferResponse.data.data.status,
          },
        },
      });

      this.logger.log(`Withdrawal of ${amount} NGN processed for user ${userId}`);

      return {
        success: true,
        message: 'Withdrawal processed successfully',
        transactionId: transaction.id,
        reference,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing withdrawal: ${err.message}`, err.stack);
      throw err;
    }
  }

  async addFunds(userId: string, amount: number, type: 'REFERRAL_EARNING' | 'BONUS_DEPOSIT' | 'REFUND' | 'OFFRAMP_PAYOUT', reference: string, metadata?: any): Promise<void> {
    try {
      // Ensure strict numeric arithmetic
      const numericAmount = Number(amount);
      
      // Get current user balance for logging
      const currentUser = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { nairaBalance: true }
      });

      const currentBalance = Number(currentUser?.nairaBalance || 0);
      const newBalance = currentBalance + numericAmount;

      this.logger.log(`Adding funds to user ${userId}: ${currentBalance} + ${numericAmount} = ${newBalance}`);

      // Add to user balance using strict numeric arithmetic
      await this.prisma.user.update({
        where: { id: userId },
        data: {
          nairaBalance: newBalance,
        },
      });

      // Create wallet transaction
      await this.prisma.walletTransaction.create({
        data: {
          userId,
          amount: numericAmount,
          type,
          status: 'SUCCESS',
          reference,
          metadata,
        },
      });

      this.logger.log(`Added ${numericAmount} NGN to user ${userId} wallet (type: ${type}). New balance: ${newBalance}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error adding funds: ${err.message}`, err.stack);
      throw err;
    }
  }
}
