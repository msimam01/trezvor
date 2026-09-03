import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { MailService } from '../mail/mail.service';

export interface Notification {
  id: string;
  type: 'low-liquidity' | 'failed-transaction' | 'user-dispute' | 'system-alert';
  title: string;
  message: string;
  urgency: 'critical' | 'high' | 'medium' | 'low';
  timestamp: string;
  read: boolean;
  metadata?: any;
}

export interface VaultBalance {
  chain: 'SOLANA' | 'BASE' | 'TON';
  symbol: string;
  balance: number;
  address: string;
  status: 'healthy' | 'warning' | 'critical';
}

export interface AdminSettings {
  platformFeePercentage: number;
  maxFeeCap: number;
  referralCommissionRate: number;
  isVirtualAccountEnabled: boolean;
  usdtBuyRateNgn: number;
  liquidityThresholds: {
    SOLANA: { minBalance: number; alertThreshold: number };
    BASE: { minBalance: number; alertThreshold: number };
    TON: { minBalance: number; alertThreshold: number };
  };
}

@Injectable()
export class AdminService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  async getVaultBalances(): Promise<VaultBalance[]> {
    // In production, this would query actual wallet balances from blockchain
    // For now, return mock data
    return [
      {
        chain: 'SOLANA',
        symbol: 'SOL',
        balance: 125.5,
        address: '7xKXtg2CW87d97TXJSDpbD5jBkheTqA83TZRuJosgAsU',
        status: 'healthy',
      },
      {
        chain: 'BASE',
        symbol: 'ETH',
        balance: 8.75,
        address: '0x742d35Cc6634C0532925a3b844Bc454e4438f44e',
        status: 'healthy',
      },
      {
        chain: 'TON',
        symbol: 'TON',
        balance: 2.8,
        address: 'UQC...x8L',
        status: 'warning',
      },
    ];
  }

  async getOrders(params: { page: number; pageSize: number; status?: string; chain?: string; search?: string }) {
    const { page, pageSize, status, chain, search } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (chain) where.chain = chain;
    if (search) {
      where.OR = [
        { id: { contains: search } },
        { targetWallet: { contains: search } },
        { user: { username: { contains: search } } },
      ];
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.order.count({ where }),
    ]);

    return {
      orders,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async getNotifications(unreadOnly = false): Promise<Notification[]> {
    // In production, this would query a notifications table
    // For now, return mock data
    const notifications: Notification[] = [
      {
        id: '1',
        type: 'low-liquidity',
        title: 'Low Liquidity Warning',
        message: 'Solana hot wallet balance is below threshold',
        urgency: 'critical',
        timestamp: new Date().toISOString(),
        read: false,
        metadata: { chain: 'SOLANA', amount: '0.5 SOL' },
      },
    ];

    return unreadOnly ? notifications.filter(n => !n.read) : notifications;
  }

  async markNotificationRead(notificationId: string): Promise<Notification> {
    // In production, this would update the notification in the database
    // For now, return a mock response
    return {
      id: notificationId,
      type: 'low-liquidity',
      title: 'Low Liquidity Warning',
      message: 'Solana hot wallet balance is below threshold',
      urgency: 'critical',
      timestamp: new Date().toISOString(),
      read: true,
      metadata: { chain: 'SOLANA', amount: '0.5 SOL' },
    };
  }

  async getUsers(params: { page: number; pageSize: number; status?: string; search?: string }) {
    const { page, pageSize, status, search } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;
    if (search) {
      where.OR = [
        { username: { contains: search } },
        { firstName: { contains: search } },
        { telegramId: { contains: search } },
      ];
    }

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { orders: true },
          },
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      users: users.map((user: any) => ({
        id: user.id,
        telegramId: user.telegramId,
        username: user.username,
        firstName: user.firstName,
        status: user.status,
        createdAt: user.createdAt,
        lastActive: user.lastActive,
        totalOrders: user._count.orders,
        lifetimeVolume: 0, // Would need to aggregate from orders
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async updateUserStatus(userId: string, status: 'active' | 'suspended' | 'banned') {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.prisma.user.update({
      where: { id: userId },
      data: { status },
    });
  }

  async getSettings(): Promise<AdminSettings> {
    // Get settings from SystemConfig table
    const systemConfig = await this.prisma.systemConfig.findUnique({
      where: { id: 'global' },
    });

    return {
      platformFeePercentage: Number(systemConfig?.platformFeePercent || 15.0),
      maxFeeCap: 200,
      referralCommissionRate: Number(systemConfig?.referralCommissionRate || 20.0),
      isVirtualAccountEnabled: systemConfig?.isVirtualAccountEnabled || false,
      usdtBuyRateNgn: Number(systemConfig?.usdtBuyRateNgn || 1550.0),
      liquidityThresholds: {
        SOLANA: { minBalance: 1.0, alertThreshold: 0.5 },
        BASE: { minBalance: 0.01, alertThreshold: 0.005 },
        TON: { minBalance: 10.0, alertThreshold: 5.0 },
      },
    };
  }

  async updateSettings(settings: any): Promise<AdminSettings> {
    console.log('Received settings update:', settings);

    // Update SystemConfig table
    const updateData: any = {};

    // Handle both flat and nested structures
    const feeSettings = settings.feeSettings || settings;

    if (feeSettings.platformFeePercentage !== undefined) {
      updateData.platformFeePercent = feeSettings.platformFeePercentage;
    }

    if (feeSettings.referralCommissionRate !== undefined) {
      updateData.referralCommissionRate = feeSettings.referralCommissionRate;
    }

    if (feeSettings.isVirtualAccountEnabled !== undefined) {
      updateData.isVirtualAccountEnabled = feeSettings.isVirtualAccountEnabled;
    }

    if (feeSettings.usdtBuyRateNgn !== undefined) {
      updateData.usdtBuyRateNgn = feeSettings.usdtBuyRateNgn;
    }

    console.log('Updating SystemConfig with:', updateData);

    if (Object.keys(updateData).length > 0) {
      await this.prisma.systemConfig.update({
        where: { id: 'global' },
        data: updateData,
      });
    }

    return this.getSettings();
  }

  async retryOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'FAILED_REFUND_NEEDED' && order.status !== 'PENDING_LIQUIDITY') {
      throw new BadRequestException('Only failed or pending liquidity orders can be retried');
    }

    // In production, this would re-queue the order for processing
    return this.prisma.order.update({
      where: { id: orderId },
      data: { status: 'DISPENSING_QUEUED' },
    });
  }

  async resolveOrder(orderId: string, notes?: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'FAILED_REFUND_NEEDED' && order.status !== 'PENDING_LIQUIDITY') {
      throw new BadRequestException('Only failed or pending liquidity orders can be resolved');
    }

    // In production, this would mark the order as resolved with notes
    return this.prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'DISPENSED_SUCCESS',
        updatedAt: new Date(),
      },
    });
  }

  async refundOrder(orderId: string) {
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.status !== 'FAILED_REFUND_NEEDED' && order.status !== 'PENDING_LIQUIDITY') {
      throw new BadRequestException('Only failed or pending liquidity orders can be refunded');
    }

    // In production, this would initiate a refund via payment gateway
    return this.prisma.order.update({
      where: { id: orderId },
      data: { 
        status: 'REFUNDED',
        updatedAt: new Date(),
      },
    });
  }

  async getOfframpRequests(params: { page: number; pageSize: number; status?: string }) {
    const { page, pageSize, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      this.prisma.offrampRequest.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.offrampRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async approveOfframp(requestId: string) {
    const request = await this.prisma.offrampRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Offramp request not found');
    }

    if (request.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // In production, this would integrate with Paystack for NGN payout
    // For now, mark as approved
    const updatedRequest = await this.prisma.offrampRequest.update({
      where: { id: requestId },
      data: { 
        status: 'APPROVED',
        updatedAt: new Date(),
      },
    });

    // Send notification to user
    await this.mailService.sendEmail(
      request.user.email || 'user@example.com',
      'Off-ramp Request Approved',
      `Your off-ramp request for ${request.cryptoAmount} ${request.cryptoAsset} has been approved. The NGN payout will be sent to your bank account within 24-48 hours.`
    );

    return updatedRequest;
  }

  async rejectOfframp(requestId: string, reason?: string) {
    const request = await this.prisma.offrampRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Offramp request not found');
    }

    if (request.status !== 'PENDING_VERIFICATION') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updatedRequest = await this.prisma.offrampRequest.update({
      where: { id: requestId },
      data: { 
        status: 'REJECTED',
        rejectionReason: reason,
        updatedAt: new Date(),
      },
    });

    // Send notification to user
    await this.mailService.sendEmail(
      request.user.email || 'user@example.com',
      'Off-ramp Request Rejected',
      `Your off-ramp request for ${request.cryptoAmount} ${request.cryptoAsset} has been rejected.${reason ? ` Reason: ${reason}` : ''} Please contact support if you believe this is an error.`
    );

    return updatedRequest;
  }

  async getAffiliatePayouts(params: { page: number; pageSize: number }) {
    const { page, pageSize } = params;
    const skip = (page - 1) * pageSize;

    const [users, total] = await Promise.all([
      this.prisma.user.findMany({
        where: {
          unpaidAffiliateBalance: { gt: 0 },
        },
        skip,
        take: pageSize,
        include: {
          _count: {
            select: { referrals: true },
          },
        },
        orderBy: { unpaidAffiliateBalance: 'desc' },
      }),
      this.prisma.user.count({
        where: {
          unpaidAffiliateBalance: { gt: 0 },
        },
      }),
    ]);

    return {
      users: users.map((user: any) => ({
        id: user.id,
        username: user.username,
        firstName: user.firstName,
        email: user.email,
        referralCode: user.referralCode,
        unpaidAffiliateBalance: user.unpaidAffiliateBalance,
        referralCount: user._count.referrals,
        createdAt: user.createdAt,
      })),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async approveAffiliatePayout(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.unpaidAffiliateBalance <= 0) {
      throw new BadRequestException('User has no unpaid affiliate balance');
    }

    // In production, this would integrate with Paystack for NGN payout
    // For now, mark as paid
    const payoutAmount = user.unpaidAffiliateBalance;

    // Get current balance for strict numeric arithmetic
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true }
    });

    const currentBalance = Number(currentUser?.wallet?.nairaBalance || 0);
    const numericPayoutAmount = Number(payoutAmount);
    const newBalance = currentBalance + numericPayoutAmount;

    // Update wallet balance and reset affiliate balance
    await this.prisma.$transaction([
      this.prisma.user.update({
        where: { id: userId },
        data: {
          unpaidAffiliateBalance: 0,
        },
      }),
      this.prisma.wallet.upsert({
        where: { userId },
        create: {
          userId,
          nairaBalance: newBalance,
        },
        update: {
          nairaBalance: newBalance,
        },
      }),
    ]);

    // Send notification to user
    await this.mailService.sendEmail(
      user.email || 'user@example.com',
      'Affiliate Payout Approved',
      `Your affiliate payout of ₦${payoutAmount.toLocaleString()} has been approved and processed.`
    );

    return this.prisma.user.findUnique({
      where: { id: userId },
      include: { wallet: true },
    });
  }

  async getRefundRequests(params: { page: number; pageSize: number; status?: string }) {
    const { page, pageSize, status } = params;
    const skip = (page - 1) * pageSize;

    const where: any = {};
    if (status) where.status = status;

    const [requests, total] = await Promise.all([
      this.prisma.refundRequest.findMany({
        where,
        skip,
        take: pageSize,
        include: {
          user: true,
          order: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.refundRequest.count({ where }),
    ]);

    return {
      requests,
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  async approveRefundRequest(requestId: string, adminNotes?: string) {
    const request = await this.prisma.refundRequest.findUnique({
      where: { id: requestId },
      include: { order: true, user: true },
    });

    if (!request) {
      throw new NotFoundException('Refund request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be approved');
    }

    // Update refund request status
    const updatedRequest = await this.prisma.refundRequest.update({
      where: { id: requestId },
      data: {
        status: 'APPROVED',
        adminNotes,
        updatedAt: new Date(),
      },
    });

    // Update order status to REFUNDED
    await this.prisma.order.update({
      where: { id: request.orderId },
      data: {
        status: 'REFUNDED',
        updatedAt: new Date(),
      },
    });

    // Send notification to user
    await this.mailService.sendEmail(
      request.user.email || 'user@example.com',
      'Refund Request Approved',
      `Your refund request for order ${request.orderId.slice(0, 8)}... has been approved. The refund will be processed to your original payment method within 5-7 business days.`
    );

    return updatedRequest;
  }

  async rejectRefundRequest(requestId: string, adminNotes?: string) {
    const request = await this.prisma.refundRequest.findUnique({
      where: { id: requestId },
      include: { user: true },
    });

    if (!request) {
      throw new NotFoundException('Refund request not found');
    }

    if (request.status !== 'PENDING') {
      throw new BadRequestException('Only pending requests can be rejected');
    }

    const updatedRequest = await this.prisma.refundRequest.update({
      where: { id: requestId },
      data: {
        status: 'REJECTED',
        adminNotes,
        updatedAt: new Date(),
      },
    });

    // Send notification to user
    await this.mailService.sendEmail(
      request.user.email || 'user@example.com',
      'Refund Request Rejected',
      `Your refund request for order ${request.orderId.slice(0, 8)}... has been rejected.${adminNotes ? ` Notes: ${adminNotes}` : ''} Please contact support if you believe this is an error.`
    );

    return updatedRequest;
  }
}
