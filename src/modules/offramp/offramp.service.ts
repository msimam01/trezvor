import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OracleService } from '../oracle/oracle.service';
import { WalletService } from '../wallet/wallet.service';
import { SettingsService } from '../settings/settings.service';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { 
  CreateOfframpRequestDto, 
  ApproveOfframpRequestDto, 
  RejectOfframpRequestDto,
  OfframpRequestResponse,
  CryptoAsset,
  PayoutDestination 
} from './offramp.dto';

@Injectable()
export class OfframpService {
  private readonly logger = new Logger(OfframpService.name);
  private readonly corporateBybitUid: string;
  private readonly quoteLockDurationMinutes = 10;
  private readonly telegramBotToken: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracleService: OracleService,
    private readonly walletService: WalletService,
    private readonly settingsService: SettingsService,
    private readonly httpService: HttpService,
  ) {
    this.corporateBybitUid = process.env.CORPORATE_BYBIT_UID || '118368783';
    this.telegramBotToken = process.env.TELEGRAM_BOT_TOKEN || '';
  }

  /**
   * Create an off-ramp request
   * Calculates NGN payout based on active parallel market rate, locks quote for 10 minutes
   */
  async createOfframpRequest(
    userId: string,
    dto: CreateOfframpRequestDto,
  ): Promise<OfframpRequestResponse> {
    try {
      // Validate saved bank if SAVED_BANK is selected
      if (dto.payoutDestination === PayoutDestination.SAVED_BANK) {
        if (!dto.savedBankId) {
          throw new BadRequestException('savedBankId is required when payoutDestination is SAVED_BANK');
        }

        const savedBank = await this.prisma.savedBank.findUnique({
          where: { id: dto.savedBankId },
        });

        if (!savedBank || savedBank.userId !== userId) {
          throw new BadRequestException('Invalid or unauthorized saved bank account');
        }

        if (!savedBank.paystackRecipientCode) {
          throw new BadRequestException('Saved bank account is not properly configured for transfers');
        }
      }

      // Get current exchange rate for the crypto asset
      // Only USDT is supported - use admin settings rate
      if (dto.cryptoAsset !== CryptoAsset.USDT) {
        throw new BadRequestException('Only USDT is currently supported for off-ramp');
      }

      // Use admin USDT buy rate
      const adminSettings = await this.settingsService.getAdminSettings();
      const rateNgn = adminSettings.usdtBuyRateNgn;

      // Calculate NGN value
      const ngnValue = dto.cryptoAmount * rateNgn;

      // Generate reference for wallet transaction
      const reference = `OFFRAMP_${userId}_${Date.now()}`;

      // Create off-ramp request
      const offrampRequest = await this.prisma.offrampRequest.create({
        data: {
          userId,
          cryptoAsset: dto.cryptoAsset,
          cryptoAmount: dto.cryptoAmount,
          ngnValue,
          exchangeRate: rateNgn,
          bybitUidUsed: this.corporateBybitUid,
          userBybitTxId: dto.userBybitTxId,
          proofImageUrl: dto.proofImageUrl,
          payoutDestination: dto.payoutDestination,
          savedBankId: dto.savedBankId,
          status: 'PENDING_VERIFICATION',
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              telegramId: true,
            },
          },
          savedBank: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
            },
          },
        },
      });

      this.logger.log(
        `Created off-ramp request ${offrampRequest.id} for user ${userId}: ${dto.cryptoAmount} ${dto.cryptoAsset} -> ₦${ngnValue}`
      );

      return this.formatOfframpResponse(offrampRequest);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error creating off-ramp request: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get user's off-ramp request history
   */
  async getUserOfframpRequests(userId: string): Promise<OfframpRequestResponse[]> {
    try {
      const requests = await this.prisma.offrampRequest.findMany({
        where: { userId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              telegramId: true,
            },
          },
          savedBank: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
            },
          },
        },
        orderBy: { createdAt: 'desc' },
      });

      return requests.map(req => this.formatOfframpResponse(req));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching user off-ramp requests: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Get pending off-ramp requests for admin review
   */
  async getPendingOfframpRequests(): Promise<OfframpRequestResponse[]> {
    try {
      const requests = await this.prisma.offrampRequest.findMany({
        where: { status: 'PENDING_VERIFICATION' },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              telegramId: true,
            },
          },
          savedBank: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
            },
          },
        },
        orderBy: { createdAt: 'asc' },
      });

      return requests.map(req => this.formatOfframpResponse(req));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error fetching pending off-ramp requests: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Approve an off-ramp request and trigger payout
   */
  async approveOfframpRequest(
    requestId: string,
    adminId: string,
  ): Promise<OfframpRequestResponse> {
    try {
      // Get the request with lock
      const request = await this.prisma.offrampRequest.findUnique({
        where: { id: requestId },
        include: {
          user: true,
          savedBank: true,
        },
      });

      if (!request) {
        throw new NotFoundException('Off-ramp request not found');
      }

      if (request.status !== 'PENDING_VERIFICATION') {
        throw new BadRequestException('Request is not in pending verification state');
      }

      // Transaction block: Update status and process payout
      const updatedRequest = await this.prisma.$transaction(async (tx) => {
        // Update status to APPROVED
        const approvedRequest = await tx.offrampRequest.update({
          where: { id: requestId },
          data: { status: 'APPROVED' },
          include: {
            user: {
              select: {
                id: true,
                email: true,
                username: true,
                firstName: true,
                telegramId: true,
              },
            },
            savedBank: {
              select: {
                id: true,
                bankName: true,
                accountNumber: true,
                accountName: true,
              },
            },
          },
        });

        // Process payout based on destination
        if (request.payoutDestination === 'INTERNAL_WALLET') {
          // Credit user's nairaBalance
          const reference = `OFFRAMP_PAYOUT_${requestId}_${Date.now()}`;
          await this.walletService.addFunds(
            request.userId,
            request.ngnValue,
            'OFFRAMP_PAYOUT',
            reference,
            {
              offrampRequestId: requestId,
              cryptoAsset: request.cryptoAsset,
              cryptoAmount: request.cryptoAmount,
            }
          );

          this.logger.log(
            `Credited ₦${request.ngnValue} to user ${request.userId} wallet for off-ramp request ${requestId}`
          );
        } else if (request.payoutDestination === 'SAVED_BANK') {
          // Execute instant Paystack Transfer
          if (!request.savedBank || !request.savedBank.paystackRecipientCode) {
            throw new BadRequestException('Saved bank account is not properly configured for transfers');
          }

          // Convert amount to kobo
          const amountInKobo = Math.round(request.ngnValue * 100);
          const reference = `OFFRAMP_TRANSFER_${requestId}_${Date.now()}`;

          const transferResponse = await firstValueFrom(
            this.httpService.post(
              'https://api.paystack.co/transfer',
              {
                source: 'balance',
                amount: amountInKobo,
                recipient: request.savedBank.paystackRecipientCode,
                reason: `Off-ramp payout for ${request.cryptoAmount} ${request.cryptoAsset}`,
                reference,
              },
              {
                headers: {
                  Authorization: `Bearer ${process.env.PAYSTACK_SECRET_KEY}`,
                  'Content-Type': 'application/json',
                },
              },
            ),
          );

          if (!transferResponse.data.status) {
            throw new BadRequestException(`Paystack transfer failed: ${transferResponse.data.message}`);
          }

          this.logger.log(
            `Executed Paystack transfer of ₦${request.ngnValue} to ${request.savedBank.accountNumber} for off-ramp request ${requestId}`
          );
        }

        return approvedRequest;
      });

      // Send Telegram notification to user
      await this.sendTelegramNotification(
        request.user.telegramId,
        `✅ Your crypto sale of ${request.cryptoAmount} ${request.cryptoAsset} (₦${request.ngnValue.toLocaleString()}) has been verified and paid out!`
      );

      this.logger.log(`Approved off-ramp request ${requestId} by admin ${adminId}`);

      return this.formatOfframpResponse(updatedRequest);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error approving off-ramp request: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Reject an off-ramp request
   */
  async rejectOfframpRequest(
    requestId: string,
    reason?: string,
  ): Promise<OfframpRequestResponse> {
    try {
      const request = await this.prisma.offrampRequest.findUnique({
        where: { id: requestId },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              telegramId: true,
            },
          },
          savedBank: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
            },
          },
        },
      });

      if (!request) {
        throw new NotFoundException('Off-ramp request not found');
      }

      if (request.status !== 'PENDING_VERIFICATION') {
        throw new BadRequestException('Request is not in pending verification state');
      }

      const updatedRequest = await this.prisma.offrampRequest.update({
        where: { id: requestId },
        data: {
          status: 'REJECTED',
          rejectionReason: reason,
        },
        include: {
          user: {
            select: {
              id: true,
              email: true,
              username: true,
              firstName: true,
              telegramId: true,
            },
          },
          savedBank: {
            select: {
              id: true,
              bankName: true,
              accountNumber: true,
              accountName: true,
            },
          },
        },
      });

      // Send Telegram notification to user
      const rejectionMessage = reason
        ? `❌ Your crypto sale request has been rejected. Reason: ${reason}`
        : `❌ Your crypto sale request has been rejected.`;

      await this.sendTelegramNotification(request.user.telegramId, rejectionMessage);

      this.logger.log(`Rejected off-ramp request ${requestId}. Reason: ${reason || 'Not provided'}`);

      return this.formatOfframpResponse(updatedRequest);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error rejecting off-ramp request: ${err.message}`, err.stack);
      throw err;
    }
  }

  /**
   * Send Telegram notification to user
   */
  private async sendTelegramNotification(telegramId: bigint | null, message: string): Promise<void> {
    if (!telegramId || !this.telegramBotToken) {
      this.logger.warn('Cannot send Telegram notification: missing telegramId or bot token');
      return;
    }

    try {
      await firstValueFrom(
        this.httpService.post(
          `https://api.telegram.org/bot${this.telegramBotToken}/sendMessage`,
          {
            chat_id: telegramId.toString(),
            text: message,
            parse_mode: 'HTML',
          },
        ),
      );

      this.logger.log(`Sent Telegram notification to user ${telegramId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send Telegram notification: ${err.message}`);
      // Don't throw error - notification failure shouldn't break the main flow
    }
  }

  /**
   * Format off-ramp request response
   */
  private formatOfframpResponse(request: any): OfframpRequestResponse {
    return {
      id: request.id,
      userId: request.userId,
      cryptoAsset: request.cryptoAsset,
      cryptoAmount: request.cryptoAmount,
      ngnValue: request.ngnValue,
      exchangeRate: request.exchangeRate,
      bybitUidUsed: request.bybitUidUsed,
      userBybitTxId: request.userBybitTxId,
      proofImageUrl: request.proofImageUrl,
      payoutDestination: request.payoutDestination,
      savedBankId: request.savedBankId,
      status: request.status,
      rejectionReason: request.rejectionReason,
      createdAt: request.createdAt,
      updatedAt: request.updatedAt,
      user: request.user,
      savedBank: request.savedBank,
    };
  }
}