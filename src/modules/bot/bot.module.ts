import { Module } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';

@Module({
  imports: [UsersModule, OrdersModule, SettingsModule],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}