import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { JwtModule } from '@nestjs/jwt';
import { WalletController } from './wallet.controller';
import { WalletPublicController } from './wallet-public.controller';
import { WalletService } from './wallet.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [
    HttpModule,
    PrismaModule,
    JwtModule.register({
      secret: process.env.JWT_SECRET || 'your-secret-key',
      signOptions: { expiresIn: '7d' },
    }),
    AuthModule,
  ],
  controllers: [WalletController, WalletPublicController],
  providers: [WalletService],
  exports: [WalletService],
})
export class WalletModule {}
