import { Controller, Post, Body, Get, Param } from '@nestjs/common';
import { WalletService, PaystackBank } from './wallet.service';

@Controller('wallet/public')
export class WalletPublicController {
  constructor(private readonly walletService: WalletService) {}

  @Get('banks')
  async getBanks(): Promise<PaystackBank[]> {
    return this.walletService.getBanks();
  }

  @Post('bank/resolve')
  async resolveBank(@Body() body: { userId: string; accountNumber: string; bankCode: string }) {
    return this.walletService.resolveAndSaveBank(body.userId, body.accountNumber, body.bankCode);
  }

  @Get('balance/:userId')
  async getBalance(@Param('userId') userId: string) {
    return this.walletService.getWalletBalance(userId);
  }

  @Post('withdraw')
  async withdraw(@Body() body: { userId: string; amount: number; bankAccountId: string }) {
    return this.walletService.withdraw(body.userId, body.amount, body.bankAccountId);
  }
}
