import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

@Injectable()
export class UserService {
  constructor(private readonly prisma: PrismaService) {}

  async getReferralInfo(userId: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      include: {
        referrals: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const referralLink = `t.me/GasBot?start=${user.referralCode}`;
    const referralCount = user.referrals.length;
    const unpaidEarnings = user.unpaidAffiliateBalance;

    return {
      referralCode: user.referralCode,
      referralLink,
      referralCount,
      unpaidEarnings,
    };
  }

  async requestPayout(userId: string, body: { bankName: string; bankAccountNumber: string; bankAccountName: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    if (user.unpaidAffiliateBalance < 1000) {
      throw new BadRequestException('Minimum payout amount is ₦1,000');
    }

    // In production, this would integrate with a payment processor
    // For now, mark balance as paid
    const payoutAmount = user.unpaidAffiliateBalance;

    await this.prisma.user.update({
      where: { id: userId },
      data: {
        unpaidAffiliateBalance: 0,
        nairaBalance: {
          increment: payoutAmount,
        },
      },
    });

    return {
      success: true,
      message: 'Payout request submitted successfully',
      amount: payoutAmount,
      bankDetails: {
        bankName: body.bankName,
        accountNumber: body.bankAccountNumber.substring(0, 4) + '****',
        accountName: body.bankAccountName,
      },
    };
  }

  async submitOfframp(userId: string, body: { token: string; amount: number; bybitUid: string; bankName: string; bankAccountNumber: string; bankAccountName: string }) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    // Create offramp request
    const offrampRequest = await this.prisma.offrampRequest.create({
      data: {
        userId,
        token: body.token,
        amount: body.amount,
        bybitUid: body.bybitUid,
        bankName: body.bankName,
        bankAccountNumber: body.bankAccountNumber,
        bankAccountName: body.bankAccountName,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'Offramp request submitted for review',
      requestId: offrampRequest.id,
    };
  }

  async submitRefundRequest(userId: string, orderId: string, reason: string) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
    });

    if (!order) {
      throw new NotFoundException('Order not found');
    }

    if (order.userId !== userId) {
      throw new BadRequestException('You can only request refunds for your own orders');
    }

    // Check if refund request already exists
    const existingRequest = await this.prisma.refundRequest.findFirst({
      where: { orderId },
    });

    if (existingRequest) {
      throw new BadRequestException('Refund request already exists for this order');
    }

    const refundRequest = await this.prisma.refundRequest.create({
      data: {
        orderId,
        userId,
        reason,
        status: 'PENDING',
      },
    });

    return {
      success: true,
      message: 'Refund request submitted for review',
      requestId: refundRequest.id,
    };
  }
}
