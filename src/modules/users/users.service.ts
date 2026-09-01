import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateUserDto {
  telegramId: bigint;
  username?: string;
  firstName?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(createUserDto: CreateUserDto) {
    try {
      const { telegramId, username, firstName } = createUserDto;

      // Try to find existing user
      let user = await this.prisma.user.findUnique({
        where: { telegramId },
      });

      if (user) {
        // Update user info if provided
        if (username || firstName) {
          user = await this.prisma.user.update({
            where: { telegramId },
            data: {
              ...(username && { username }),
              ...(firstName && { firstName }),
            },
          });
          this.logger.log(`Updated user with telegramId: ${telegramId}`);
        } else {
          this.logger.log(`Found existing user with telegramId: ${telegramId}`);
        }
      } else {
        // Create new user
        const referralCode = `${username?.substring(0, 3).toUpperCase() || 'TG'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        user = await this.prisma.user.create({
          data: {
            telegramId,
            username,
            firstName,
            referralCode,
            role: 'USER',
            status: 'active',
            nairaBalance: 0.0,
            unpaidAffiliateBalance: 0.0,
          },
        });
        this.logger.log(`Created new user with telegramId: ${telegramId}`);
      }

      return user;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error finding/creating user: ${err.message}`, err.stack);
      throw err;
    }
  }

  async findByTelegramId(telegramId: bigint) {
    return this.prisma.user.findUnique({
      where: { telegramId },
      include: { orders: true },
    });
  }

  async findById(id: string) {
    return this.prisma.user.findUnique({
      where: { id },
      include: { orders: true },
    });
  }
}