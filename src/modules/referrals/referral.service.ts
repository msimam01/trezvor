import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { ConfigService } from '@nestjs/config';
import { WalletService } from '../wallet/wallet.service';

export interface ReferralStats {
  referralCode: string;
  referralLink: string;
  totalReferred: number;
  totalEarned: number;
  withdrawableBalance: number;
  totalPaidOut: number;
}

interface FirstDepositBonusResult {
  success: boolean;
  message: string;
  referrerId?: string;
  bonusAmount?: number;
}

interface TransactionCommissionResult {
  success: boolean;
  message: string;
  referrerId?: string;
  commissionAmount?: number;
  commissionRate?: number;
}

@Injectable()
export class ReferralService {
  private readonly logger = new Logger(ReferralService.name);
  private readonly defaultBonusAmount: number;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly walletService: WalletService,
  ) {
    this.defaultBonusAmount = this.configService.get<number>('REFERRAL_BONUS_AMOUNT') || 200.0;
  }

  async getReferralStats(userId: string): Promise<ReferralStats> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referralRecordsGiven: true,
        wallet: {
          include: {
            transactions: true,
          },
        },
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const referralRecords = user.referralRecordsGiven;
    const totalReferred = referralRecords.length;

    // Total Earned: Sum of all REFERRAL_EARNING wallet transactions for this user
    const totalEarned = user.wallet?.transactions
      .filter((transaction) => transaction.type === 'REFERRAL_EARNING' && transaction.status === 'SUCCESS')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;

    // Withdrawable Balance: Current wallet nairaBalance
    const withdrawableBalance = Number(user.wallet?.nairaBalance || 0);

    // Total Paid Out: Sum of all completed bank withdrawal transactions
    const totalPaidOut = user.wallet?.transactions
      .filter((transaction) => transaction.type === 'WITHDRAWAL' && transaction.status === 'SUCCESS')
      .reduce((sum, transaction) => sum + Number(transaction.amount), 0) || 0;

    const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'trezvor_bot';
    const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

    return {
      referralCode: user.referralCode,
      referralLink,
      totalReferred,
      totalEarned,
      withdrawableBalance,
      totalPaidOut,
    };
  }

  async getPublicReferralStats(userId: string): Promise<ReferralStats> {
    return this.getReferralStats(userId);
  }

  async processFirstDepositBonus(
    refereeId: string,
    depositAmount: number,
  ): Promise<FirstDepositBonusResult> {
    this.logger.log(`Processing first deposit bonus for referee ${refereeId}, amount: ${depositAmount}`);

    // Check if virtual accounts are enabled
    const systemConfig = await this.prisma.systemConfig.findUnique({
      where: { id: 'global' },
    });

    if (!systemConfig?.isVirtualAccountEnabled) {
      this.logger.log(`Virtual accounts are disabled, skipping first deposit bonus`);
      // Still mark as completed first deposit
      await this.prisma.user.update({
        where: { id: refereeId },
        data: { hasCompletedFirstDeposit: true },
      });
      return {
        success: false,
        message: 'Virtual accounts are disabled',
      };
    }

    // Find the referee
    const referee = await this.prisma.user.findUnique({
      where: { id: refereeId },
      include: {
        referralRecordReceived: true,
      },
    });

    if (!referee) {
      return {
        success: false,
        message: 'Referee not found',
      };
    }

    // Check if this is their first deposit
    if (referee.hasCompletedFirstDeposit) {
      this.logger.log(`Referee ${refereeId} has already completed first deposit, skipping bonus`);
      return {
        success: false,
        message: 'First deposit already processed',
      };
    }

    // Check if they have a referrer
    if (!referee.referredById || !referee.referralRecordReceived) {
      this.logger.log(`Referee ${refereeId} has no referrer, skipping bonus`);
      // Still mark as completed first deposit
      await this.prisma.user.update({
        where: { id: refereeId },
        data: { hasCompletedFirstDeposit: true },
      });
      return {
        success: false,
        message: 'No referrer found',
      };
    }

    const referralRecord = referee.referralRecordReceived;

    // Check if bonus already rewarded
    if (referralRecord.status === 'REWARDED') {
      this.logger.log(`Referral bonus already rewarded for ${refereeId}`);
      await this.prisma.user.update({
        where: { id: refereeId },
        data: { hasCompletedFirstDeposit: true },
      });
      return {
        success: false,
        message: 'Bonus already rewarded',
      };
    }

    // Get referrer
    const referrer = await this.prisma.user.findUnique({
      where: { id: referralRecord.referrerId },
    });

    if (!referrer) {
      this.logger.error(`Referrer ${referralRecord.referrerId} not found`);
      return {
        success: false,
        message: 'Referrer not found',
      };
    }

    try {
      // Mark referee as completed first deposit
      await this.prisma.user.update({
        where: { id: refereeId },
        data: { hasCompletedFirstDeposit: true },
      });

      // Update referral record status
      await this.prisma.referralRecord.update({
        where: { id: referralRecord.id },
        data: {
          status: 'REWARDED',
          rewardedAt: new Date(),
        },
      });

      // Use WalletService for atomic balance update
      await this.walletService.addFunds(
        referrer.id,
        referralRecord.bonusAmount,
        'REFERRAL_EARNING',
        `REF-BONUS-${refereeId}-${Date.now()}`,
        {
          refereeId,
          refereeName: referee.firstName || referee.username || 'User',
          depositAmount,
        },
      );

      this.logger.log(
        `Successfully processed referral bonus: ₦${referralRecord.bonusAmount} for referrer ${referrer.id} from referee ${refereeId}`,
      );

      // Send notification to referrer (this would be handled by a notification service)
      await this.sendReferralBonusNotification(referrer, referee, referralRecord.bonusAmount);

      return {
        success: true,
        message: 'First deposit bonus processed successfully',
        referrerId: referrer.id,
        bonusAmount: referralRecord.bonusAmount,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing first deposit bonus: ${err.message}`, err.stack);
      return {
        success: false,
        message: 'Error processing bonus',
      };
    }
  }

  async createReferralRecord(referrerId: string, refereeId: string): Promise<void> {
    // Check if referral record already exists
    const existingRecord = await this.prisma.referralRecord.findUnique({
      where: { refereeId },
    });

    if (existingRecord) {
      this.logger.log(`Referral record already exists for referee ${refereeId}`);
      return;
    }

    await this.prisma.referralRecord.create({
      data: {
        referrerId,
        refereeId,
        bonusAmount: this.defaultBonusAmount,
        status: 'PENDING',
      },
    });

    this.logger.log(`Created referral record: referrer ${referrerId} -> referee ${refereeId}`);
  }

  async processTransactionCommission(
    orderId: string,
    platformFeeNgn: number,
  ): Promise<TransactionCommissionResult> {
    this.logger.log(`Processing transaction commission for order ${orderId}, platform fee: ₦${platformFeeNgn}`);

    try {
      // Get the order with user details
      const order = await this.prisma.order.findUnique({
        where: { id: orderId },
        include: {
          user: true,
        },
      });

      if (!order) {
        return {
          success: false,
          message: 'Order not found',
        };
      }

      // Check if the user has a referrer
      if (!order.user.referredById) {
        this.logger.log(`Order ${orderId} user has no referrer, skipping commission`);
        return {
          success: false,
          message: 'No referrer found',
        };
      }

      // Get the referrer
      const referrer = await this.prisma.user.findUnique({
        where: { id: order.user.referredById },
      });

      if (!referrer) {
        this.logger.error(`Referrer ${order.user.referredById} not found`);
        return {
          success: false,
          message: 'Referrer not found',
        };
      }

      // Get the current commission rate from SystemConfig
      const systemConfig = await this.prisma.systemConfig.findUnique({
        where: { id: 'global' },
      });

      const commissionRate = Number(systemConfig?.referralCommissionRate || 20.0);

      // Calculate commission: platformFeeNgn * (commissionRate / 100)
      const commissionAmount = platformFeeNgn * (commissionRate / 100);

      this.logger.log(
        `Calculated commission: ₦${commissionAmount} (platform fee: ₦${platformFeeNgn} * ${commissionRate}%) for referrer ${referrer.id}`,
      );

      // Use WalletService for atomic balance update
      await this.walletService.addFunds(
        referrer.id,
        commissionAmount,
        'REFERRAL_EARNING',
        `REF-COMMISSION-${orderId}-${Date.now()}`,
        {
          orderId,
          refereeId: order.userId,
          refereeName: order.user.firstName || order.user.username || 'User',
          platformFeeNgn,
          commissionRate,
        },
      );

      // Update referral record with commission details
      const referralRecord = await this.prisma.referralRecord.findUnique({
        where: { refereeId: order.userId },
      });

      if (referralRecord) {
        await this.prisma.referralRecord.update({
          where: { id: referralRecord.id },
          data: {
            bonusAmount: commissionAmount,
            status: 'REWARDED',
            rewardedAt: new Date(),
          },
        });
      }

      this.logger.log(
        `Successfully processed transaction commission: ₦${commissionAmount} for referrer ${referrer.id} from order ${orderId}`,
      );

      // Send notification to referrer
      await this.sendCommissionNotification(referrer, order, commissionAmount, commissionRate);

      return {
        success: true,
        message: 'Transaction commission processed successfully',
        referrerId: referrer.id,
        commissionAmount,
        commissionRate,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing transaction commission: ${err.message}`, err.stack);
      return {
        success: false,
        message: 'Error processing commission',
      };
    }
  }

  private async sendReferralBonusNotification(
    referrer: any,
    referee: any,
    bonusAmount: number,
  ): Promise<void> {
    // This would integrate with your notification service or Telegram bot
    // For now, we'll just log it
    this.logger.log(
      `🎉 Notification: Referrer ${referrer.firstName || referrer.username} earned ₦${bonusAmount}! Their referral ${referee.firstName || referee.username} made their first deposit.`,
    );

    // TODO: Integrate with BotService to send Telegram notification
    // if (referrer.telegramId) {
    //   await this.botService.sendNotification(
    //     referrer.telegramId,
    //     `🎉 You earned ₦${bonusAmount}! Your referral ${referee.firstName || referee.username} made their first deposit.`
    //   );
    // }
  }

  private async sendCommissionNotification(
    referrer: any,
    order: any,
    commissionAmount: number,
    commissionRate: number,
  ): Promise<void> {
    // Log notification for now - Telegram notifications would be handled by a separate notification service
    this.logger.log(
      `💰 Notification: Referrer ${referrer.firstName || referrer.username} earned ₦${commissionAmount} (${commissionRate}%) from their referral's gas purchase.`,
    );
  }
}