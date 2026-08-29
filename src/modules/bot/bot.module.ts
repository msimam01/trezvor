import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';

@Module({
  imports: [UsersModule, OrdersModule, SettingsModule, PaymentsModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}