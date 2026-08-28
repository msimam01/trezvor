import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../../prisma/prisma.module';

@Module({
  imports: [PrismaModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}