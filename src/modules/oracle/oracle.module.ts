import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ConfigModule } from '@nestjs/config';
import { OracleService } from './oracle.service';

@Module({
  imports: [HttpModule, ConfigModule],
  providers: [OracleService],
  exports: [OracleService],
})
export class OracleModule {}
