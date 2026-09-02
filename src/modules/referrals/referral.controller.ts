import { Controller, Get, Post, Body, Param, UseGuards, Request, Logger } from '@nestjs/common';
import { ReferralService, ReferralStats } from './referral.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { ProcessFirstDepositBonusDto, ProcessTransactionCommissionDto } from './referral.dto';

@Controller('referrals')
export class ReferralController {
  private readonly logger = new Logger(ReferralController.name);

  constructor(private readonly referralService: ReferralService) {}

  @Get('stats')
  @UseGuards(JwtAuthGuard)
  async getReferralStats(@Request() req: any): Promise<{ success: boolean; data?: ReferralStats; error?: string }> {
    try {
      const userId = req.user.sub;
      const stats = await this.referralService.getReferralStats(userId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error getting referral stats: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  @Get('public/stats/:userId')
  async getPublicReferralStats(@Param('userId') userId: string): Promise<{ success: boolean; data?: ReferralStats; error?: string }> {
    try {
      const stats = await this.referralService.getPublicReferralStats(userId);
      return {
        success: true,
        data: stats,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error getting public referral stats: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  @Post('process-first-deposit')
  async processFirstDepositBonus(@Body() dto: ProcessFirstDepositBonusDto) {
    try {
      const result = await this.referralService.processFirstDepositBonus(
        dto.refereeId,
        dto.depositAmount,
      );
      return {
        success: result.success,
        message: result.message,
        data: result.success ? {
          referrerId: result.referrerId,
          bonusAmount: result.bonusAmount,
        } : undefined,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing first deposit bonus: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  @Post('process-transaction-commission')
  async processTransactionCommission(@Body() dto: ProcessTransactionCommissionDto) {
    try {
      const result = await this.referralService.processTransactionCommission(
        dto.orderId,
        dto.platformFeeNgn,
      );
      return {
        success: result.success,
        message: result.message,
        data: result.success ? {
          referrerId: result.referrerId,
          commissionAmount: result.commissionAmount,
          commissionRate: result.commissionRate,
        } : undefined,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing transaction commission: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }
}