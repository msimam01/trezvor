import { Module, forwardRef } from '@nestjs/common';
import { BotService } from './bot.service';
import { UsersModule } from '../users/users.module';
import { OrdersModule } from '../orders/orders.module';
import { SettingsModule } from '../settings/settings.module';
import { PaymentsModule } from '../payments/payments.module';
import { QueueModule } from '../queue/queue.module';

@Module({
  imports: [UsersModule, OrdersModule, SettingsModule, PaymentsModule, forwardRef(() => QueueModule)],
  providers: [BotService],
  exports: [BotService],
})
export class BotModule {}