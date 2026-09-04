import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OracleService } from './oracle.service';
import { FeeModule } from '../fee/fee.module';

@Module({
  imports: [HttpModule, ConfigModule, FeeModule],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
