import { Module, forwardRef } from '@nestjs/common';
import { BullModule } from '@nestjs/bullmq';
import { ConfigService } from '@nestjs/config';
import { GasDispenseProcessor } from './gas-dispense.processor';
import { OrdersModule } from '../orders/orders.module';
import { Web3Module } from '../web3/web3.module';
import { BotModule } from '../bot/bot.module';

const queueModule = BullModule.forRootAsync({
  imports: [],
  useFactory: (configService: ConfigService) => ({
    connection: {
      host: configService.get<string>('REDIS_HOST', '127.0.0.1'),
      port: configService.get<number>('REDIS_PORT', 6379),
      // Add connection options for WSL compatibility
      lazyConnect: true,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      },
    },
  }),
  inject: [ConfigService],
});

@Module({
  imports: [
    queueModule,
    BullModule.registerQueue({
      name: 'gas-dispense-queue',
    }),
    OrdersModule,
    Web3Module,
    forwardRef(() => BotModule),
  ],
  providers: [GasDispenseProcessor],
  exports: [BullModule],
})
export class QueueModule {}