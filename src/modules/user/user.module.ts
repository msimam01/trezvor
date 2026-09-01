import { Module } from '@nestjs/common';
import { UserController, OrderRefundController } from './user.controller';
import { UserService } from './user.service';
import { PrismaModule } from '../../prisma/prisma.module';
import { AuthModule } from '../auth/auth.module';

@Module({
  imports: [PrismaModule, AuthModule],
  controllers: [UserController, OrderRefundController],
  providers: [UserService],
  exports: [UserService],
})
export class UserModule {}
