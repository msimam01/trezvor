import { Controller, Post, Get, Body, UseGuards, Request, HttpException, HttpStatus, Logger, Param, Patch } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../../prisma/prisma.service';
import { JwtAuthGuard } from './jwt-auth.guard';
import * as bcrypt from 'bcrypt';

interface RequestWithUser extends Request {
  user: {
    sub: string;
    email?: string;
    role?: string;
    isAdmin?: boolean;
  };
}

@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private jwtService: JwtService,
    private prisma: PrismaService,
  ) {}

  @Post('register')
  async register(@Body() body: { email: string; password: string; username?: string; firstName?: string }) {
    const { email, password, username, firstName } = body;

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      throw new HttpException('Email already registered', HttpStatus.BAD_REQUEST);
    }

    // Hash password
    const passwordHash = await bcrypt.hash(password, 10);

    // Generate referral code
    const referralCode = `${username?.substring(0, 3).toUpperCase() || 'USER'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

    // Create user
    const user = await this.prisma.user.create({
      data: {
        email,
        passwordHash,
        username: username || email.split('@')[0],
        firstName: firstName || 'User',
        role: 'USER',
        status: 'active',
        referralCode,
        nairaBalance: 0.0,
        unpaidAffiliateBalance: 0.0,
      },
    });

    const payload = { sub: user.id, email: user.email, role: user.role, isAdmin: user.role === 'ADMIN' };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        role: user.role,
        referralCode: user.referralCode,
      },
    };
  }

  @Post('login')
  async login(@Body() body: { email: string; password: string }) {
    const { email, password } = body;

    // Find user by email
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user || !user.passwordHash) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    // Verify password
    const isPasswordValid = await bcrypt.compare(password, user.passwordHash);
    if (!isPasswordValid) {
      throw new HttpException('Invalid credentials', HttpStatus.UNAUTHORIZED);
    }

    // Update last active
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastActive: new Date() },
    });

    const payload = { sub: user.id, email: user.email, role: user.role, isAdmin: user.role === 'ADMIN' };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        email: user.email,
        username: user.username,
        firstName: user.firstName,
        role: user.role,
        referralCode: user.referralCode,
      },
    };
  }

  @Post('telegram')
  async telegramAuth(@Body() body: { telegramId: string; username?: string; firstName?: string; authDate: number; hash: string }) {
    const { telegramId, username, firstName } = body;

    // Find or create user by telegramId
    let user = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
    });

    if (!user) {
      // Generate referral code for new user
      const referralCode = `${username?.substring(0, 3).toUpperCase() || 'TG'}-${Math.random().toString(36).substring(2, 8).toUpperCase()}`;

      user = await this.prisma.user.create({
        data: {
          telegramId: BigInt(telegramId),
          username: username || 'telegram_user',
          firstName: firstName || 'Telegram',
          role: 'USER',
          status: 'active',
          referralCode,
          nairaBalance: 0.0,
          unpaidAffiliateBalance: 0.0,
        },
      });
    } else {
      // Update existing user's telegram info if provided
      if (username || firstName) {
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            ...(username && { username }),
            ...(firstName && { firstName }),
            lastActive: new Date(),
          },
        });
      }
    }

    const payload = { sub: user.id, telegramId: user.telegramId?.toString(), role: user.role, isAdmin: user.role === 'ADMIN' };
    return {
      access_token: await this.jwtService.signAsync(payload),
      user: {
        id: user.id,
        telegramId: user.telegramId?.toString(),
        username: user.username,
        firstName: user.firstName,
        role: user.role,
        referralCode: user.referralCode,
      },
    };
  }

  @Post('admin/login')
  async adminLogin(@Body() body: { secret: string }) {
    if (body.secret === process.env.ADMIN_SECRET) {
      const payload = { sub: 'admin', isAdmin: true, role: 'ADMIN' };
      return {
        access_token: await this.jwtService.signAsync(payload),
        user: payload,
      };
    }
    throw new HttpException('Invalid admin secret', HttpStatus.UNAUTHORIZED);
  }

  @Post('admin/set-admin')
  async setAdmin(@Body() body: { secret: string; userId: string }) {
    if (body.secret !== process.env.ADMIN_SECRET) {
      throw new HttpException('Invalid admin secret', HttpStatus.UNAUTHORIZED);
    }

    const user = await this.prisma.user.update({
      where: { id: body.userId },
      data: { isAdmin: true, role: 'ADMIN' },
    });
    return {
      success: true,
      user: {
        id: user.id,
        email: user.email,
        isAdmin: user.role === 'ADMIN',
        role: user.role,
      },
    };
  }

  @Post('telegram/generate-link-code')
  async generateLinkCode(@Body() body: { telegramId: string }) {
    const { telegramId } = body;

    // Generate 6-digit alphanumeric code
    const code = this.generateSixDigitCode();

    // Set expiration to 10 minutes from now
    const expiresAt = new Date(Date.now() + 10 * 60 * 1000);

    // Check if there's an existing unexpired code for this telegramId
    const existingCode = await this.prisma.accountLinkCode.findFirst({
      where: {
        telegramId,
        expiresAt: {
          gt: new Date(),
        },
      },
    });

    if (existingCode) {
      // Return existing code
      return {
        code: existingCode.code,
        expiresAt: existingCode.expiresAt,
      };
    }

    // Save new code
    const linkCode = await this.prisma.accountLinkCode.create({
      data: {
        code,
        telegramId,
        expiresAt,
      },
    });

    this.logger.log(`Generated link code ${code} for telegramId ${telegramId}`);

    return {
      code: linkCode.code,
      expiresAt: linkCode.expiresAt,
    };
  }

  @Get('telegram/validate-link-code/:code')
  async validateLinkCode(@Param('code') code: string) {
    try {
      const linkCode = await this.prisma.accountLinkCode.findUnique({
        where: { code },
      });

      if (!linkCode) {
        return {
          valid: false,
          message: 'Invalid code',
        };
      }

      if (linkCode.expiresAt < new Date()) {
        // Delete expired code
        await this.prisma.accountLinkCode.delete({
          where: { id: linkCode.id },
        });
        return {
          valid: false,
          message: 'Code expired',
        };
      }

      return {
        valid: true,
        expiresAt: linkCode.expiresAt,
      };
    } catch (error) {
      this.logger.error(`Error validating link code: ${error}`);
      return {
        valid: false,
        message: 'Error validating code',
      };
    }
  }

  @Get('profile')
  @UseGuards(JwtAuthGuard)
  async getProfile(@Request() req: RequestWithUser) {
    const userId = req.user.sub;

    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        telegramId: true,
        role: true,
        referralCode: true,
        status: true,
      },
    });

    if (!user) {
      throw new HttpException('User not found', HttpStatus.NOT_FOUND);
    }

    return {
      ...user,
      telegramId: user.telegramId?.toString(),
    };
  }

  @Post('telegram/link-account')
  @UseGuards(JwtAuthGuard)
  async linkAccount(@Request() req: RequestWithUser, @Body() body: { code: string }) {
    const { code } = body;
    const userId = req.user.sub;

    // Find the link code
    const linkCode = await this.prisma.accountLinkCode.findUnique({
      where: { code },
    });

    if (!linkCode) {
      throw new HttpException('Invalid or expired code', HttpStatus.BAD_REQUEST);
    }

    // Check if code is expired
    if (linkCode.expiresAt < new Date()) {
      // Delete expired code
      await this.prisma.accountLinkCode.delete({
        where: { id: linkCode.id },
      });
      throw new HttpException('Invalid or expired code', HttpStatus.BAD_REQUEST);
    }

    const telegramId = linkCode.telegramId;

    // Find the Telegram user
    const telegramUser = await this.prisma.user.findUnique({
      where: { telegramId: BigInt(telegramId) },
      include: {
        orders: true,
        savedBanks: true,
        wallet: {
          include: {
            transactions: true,
          },
        },
      },
    });

    if (!telegramUser) {
      throw new HttpException('Telegram user not found', HttpStatus.BAD_REQUEST);
    }

    // Find the web user
    const webUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });

    if (!webUser) {
      throw new HttpException('Web user not found', HttpStatus.BAD_REQUEST);
    }

    // Check if web user already has a telegramId linked
    if (webUser.telegramId) {
      throw new HttpException('Account already linked to Telegram', HttpStatus.BAD_REQUEST);
    }

    // Check if telegram user is the same as web user (already linked)
    if (telegramUser.id === userId) {
      // Delete the used code
      await this.prisma.accountLinkCode.delete({
        where: { id: linkCode.id },
      });
      return {
        success: true,
        message: 'Account already linked',
      };
    }

    // Start a transaction to merge data
    await this.prisma.$transaction(async (prisma) => {
      // First, remove telegramId from telegram user to avoid unique constraint violation
      await prisma.user.update({
        where: { id: telegramUser.id },
        data: { telegramId: null },
      });

      // Transfer orders from telegram user to web user
      if (telegramUser.orders.length > 0) {
        await prisma.order.updateMany({
          where: { userId: telegramUser.id },
          data: { userId: webUser.id },
        });
      }

      // Transfer saved banks from telegram user to web user
      if (telegramUser.savedBanks.length > 0) {
        await prisma.savedBank.updateMany({
          where: { userId: telegramUser.id },
          data: { userId: webUser.id },
        });
      }

      // Transfer wallet transactions from telegram user to web user
      if (telegramUser.wallet?.transactions && telegramUser.wallet.transactions.length > 0) {
        await prisma.walletTransaction.updateMany({
          where: { walletId: telegramUser.wallet.id },
          data: { walletId: webUser.wallet?.id || telegramUser.wallet.id },
        });
      }

      // Add telegram user's balance to web user using strict numeric arithmetic
      if (telegramUser.wallet?.nairaBalance && telegramUser.wallet.nairaBalance > 0) {
        const currentWebUser = await prisma.user.findUnique({
          where: { id: webUser.id },
          include: { wallet: true },
        });

        const currentBalance = Number(currentWebUser?.wallet?.nairaBalance || 0);
        const telegramBalance = Number(telegramUser.wallet.nairaBalance);
        const newBalance = currentBalance + telegramBalance;

        // Update or create web user's wallet
        await prisma.wallet.upsert({
          where: { userId: webUser.id },
          create: {
            userId: webUser.id,
            nairaBalance: newBalance,
          },
          update: {
            nairaBalance: newBalance,
          },
        });

        // Reset telegram user's wallet balance
        if (telegramUser.wallet) {
          await prisma.wallet.update({
            where: { id: telegramUser.wallet.id },
            data: { nairaBalance: 0 },
          });
        }
      }

      // Add telegram user's unpaid affiliate balance to web user using strict numeric arithmetic
      if (telegramUser.unpaidAffiliateBalance > 0) {
        const currentWebUser = await prisma.user.findUnique({
          where: { id: webUser.id },
          select: { unpaidAffiliateBalance: true }
        });

        const currentUnpaidBalance = Number(currentWebUser?.unpaidAffiliateBalance || 0);
        const telegramUnpaidBalance = Number(telegramUser.unpaidAffiliateBalance);
        const newUnpaidBalance = currentUnpaidBalance + telegramUnpaidBalance;

        await prisma.user.update({
          where: { id: webUser.id },
          data: {
            unpaidAffiliateBalance: newUnpaidBalance,
          },
        });
      }

      // Update web user with telegramId (now safe since telegramId was removed from telegram user)
      await prisma.user.update({
        where: { id: webUser.id },
        data: {
          telegramId: BigInt(telegramId),
          // Also update username/firstName if web user doesn't have them
          ...(webUser.username || telegramUser.username ? {
            username: webUser.username || telegramUser.username,
          } : {}),
          ...(webUser.firstName || telegramUser.firstName ? {
            firstName: webUser.firstName || telegramUser.firstName,
          } : {}),
        },
      });

      // Delete the standalone telegram user (if it's different from web user)
      if (telegramUser.id !== webUser.id) {
        await prisma.user.delete({
          where: { id: telegramUser.id },
        });
      }

      // Delete the used link code
      await prisma.accountLinkCode.delete({
        where: { id: linkCode.id },
      });
    });

    this.logger.log(`Successfully linked account ${userId} with telegramId ${telegramId}`);

    return {
      success: true,
      message: 'Account successfully linked',
      telegramId: telegramId,
    };
  }

  private generateSixDigitCode(): string {
    // Generate a 6-digit alphanumeric code (e.g., G-849201)
    const numericPart = Math.floor(100000 + Math.random() * 900000).toString();
    return `G-${numericPart}`;
  }
}