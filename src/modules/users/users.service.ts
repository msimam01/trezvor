import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateUserDto {
  telegramId: bigint;
  username?: string;
  firstName?: string;
  referralCode?: string;
}

@Injectable()
export class UsersService {
  private readonly logger = new Logger(UsersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async findOrCreateUser(createUserDto: CreateUserDto) {
    try {
      const { telegramId, username, firstName, referralCode: incomingReferralCode } = createUserDto;

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
        const userReferralCode = `${username?.substring(0, 3).toUpperCase() || 'TG'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;
        
        let referredById: string | undefined;
        
        // Handle referral code if provided
        if (incomingReferralCode) {
          const referrer = await this.prisma.user.findUnique({
            where: { referralCode: incomingReferralCode },
          });
          
          if (referrer) {
            referredById = referrer.id;
            this.logger.log(`User ${telegramId} referred by ${referrer.id} with code ${incomingReferralCode}`);
          } else {
            this.logger.warn(`Invalid referral code: ${incomingReferralCode}`);
          }
        }
        
        user = await this.prisma.user.create({
          data: {
            telegramId,
            username,
            firstName,
            referralCode: userReferralCode,
            referredById,
            role: 'USER',
            status: 'active',
            unpaidAffiliateBalance: 0.0,
            wallet: {
              create: {
                nairaBalance: 0.0,
              },
            },
          },
        });
        this.logger.log(`Created new user with telegramId: ${telegramId}`);

        // Create referral record if user was referred
        if (referredById) {
          await this.prisma.referralRecord.create({
            data: {
              referrerId: referredById,
              refereeId: user.id,
              bonusAmount: 200.0, // Default bonus amount
              status: 'PENDING',
            },
          });
          this.logger.log(`Created referral record: ${referredById} -> ${user.id}`);
        }
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