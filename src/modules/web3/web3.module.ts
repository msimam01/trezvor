import { Module } from '@nestjs/common';
import { ConfigModule } from '@nestjs/config';
import { Web3Service } from './web3.service';
import { MailModule } from '../mail/mail.module';

@Module({
  imports: [ConfigModule, MailModule],
  providers: [Web3Service],
  exports: [Web3Service],
})
export class Web3Module {}
