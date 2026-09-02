import { Module } from '@nestjs/common';
import { OfframpService } from './offramp.service';
import { OfframpController, AdminOfframpController } from './offramp.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { OracleModule } from '../oracle/oracle.module';
import { WalletModule } from '../wallet/wallet.module';
import { HttpModule } from '@nestjs/axios';
import { AuthModule } from '../auth/auth.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [PrismaModule, OracleModule, WalletModule, HttpModule, AuthModule, SettingsModule],
  controllers: [OfframpController, AdminOfframpController],
  providers: [OfframpService],
  exports: [OfframpService],
})
export class OfframpModule {}