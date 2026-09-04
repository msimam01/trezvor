import { Module } from '@nestjs/common';
import { FeeService } from './fee.service';
import { HttpModule } from '@nestjs/axios';
import { PrismaModule } from '../../prisma/prisma.module';
import { ConfigModule } from '@nestjs/config';

@Module({
  imports: [HttpModule, PrismaModule, ConfigModule],
  providers: [FeeService],
  exports: [FeeService],
})
export class FeeModule {}
