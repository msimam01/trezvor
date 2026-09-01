import { Module } from '@nestjs/common';
import { OrdersService } from './orders.service';
import { OrdersController } from './orders.controller';
import { PrismaModule } from '../../prisma/prisma.module';
import { OracleModule } from '../oracle/oracle.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, OracleModule, AuthModule],
  controllers: [OrdersController],
  providers: [OrdersService],
  exports: [OrdersService],
})
export class OrdersModule {}