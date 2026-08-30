import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { OracleModule } from '../oracle/oracle.module';

@Module({
  imports: [PrismaModule, OracleModule],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}