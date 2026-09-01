import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { QueueModule } from '../queue/queue.module';
import { OracleModule } from '../oracle/oracle.module';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [UsersModule, OrdersModule, SettingsModule, PaymentsModule, forwardRef(() => QueueModule), OracleModule, PrismaModule, AuthModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}