import { Controller, Get, Post, Body, UseGuards, Request, HttpException, HttpStatus, Param } from '@nestjs/common';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';
import { UserService } from './user.service';

@Controller('user')
@UseGuards(JwtAuthGuard)
export class UserController {
  constructor(private readonly userService: UserService) {}

  @Get('referral')
  async getReferralInfo(@Request() req: any) {
    const userId = req.user.sub;
    return this.userService.getReferralInfo(userId);
  }

  @Post('referral/payout')
  async requestPayout(@Request() req: any, @Body() body: { bankName: string; bankAccountNumber: string; bankAccountName: string }) {
    const userId = req.user.sub;
    return this.userService.requestPayout(userId, body);
  }

  @Post('offramp/bybit')
  async submitOfframp(@Request() req: any, @Body() body: { token: string; amount: number; bybitUid: string; bankName: string; bankAccountNumber: string; bankAccountName: string }) {
    const userId = req.user.sub;
    return this.userService.submitOfframp(userId, body);
  }
}

@Controller('orders')
@UseGuards(JwtAuthGuard)
export class OrderRefundController {
  constructor(private readonly userService: UserService) {}

  @Post(':id/refund-request')
  async submitRefundRequest(@Request() req: any, @Param('id') orderId: string, @Body() body: { reason: string }) {
    const userId = req.user.sub;
    return this.userService.submitRefundRequest(userId, orderId, body.reason);
  }
}
