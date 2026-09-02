import { Controller, Get, Post, Body, Param, UseGuards, Request } from '@nestjs/common';
import { WalletService, PaystackBank } from './wallet.service';
import { JwtAuthGuard } from '../auth/jwt-auth.guard';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email?: string;
    role?: string;
    isAdmin?: boolean;
  };
}

@Controller('wallet')
@UseGuards(JwtAuthGuard)
export class WalletController {
  constructor(private readonly walletService: WalletService) {}

  @Get('banks')
  async getBanks(): Promise<PaystackBank[]> {
    return this.walletService.getBanks();
  }

  @Post('bank/resolve')
  async resolveBank(
    @Request() req: RequestWithUser,
    @Body() body: { accountNumber: string; bankCode: string },
  ) {
    const userId = req.user.sub;
    return this.walletService.resolveAndSaveBank(userId, body.accountNumber, body.bankCode);
  }

  @Get('balance')
  async getBalance(@Request() req: RequestWithUser) {
    const userId = req.user.sub;
    return this.walletService.getWalletBalance(userId);
  }

  @Post('withdraw')
  async withdraw(
    @Request() req: RequestWithUser,
    @Body() body: { amount: number; bankAccountId: string },
  ) {
    const userId = req.user.sub;
    return this.walletService.withdraw(userId, body.amount, body.bankAccountId);
  }
}
