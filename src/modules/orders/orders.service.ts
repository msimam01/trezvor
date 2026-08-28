import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';

interface CreateOrderDto {
  userId: string;
  chain: 'SOLANA' | 'BASE' | 'TON';
  targetWallet: string;
  fiatAmountNaira: number;
  feeNaira: number;
  totalAmount: number;
  cryptoAmount: number;
  paymentGateway: 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY';
  status: 'PENDING_PAYMENT' | 'PAYMENT_VERIFIED' | 'DISPENSING_QUEUED' | 'DISPENSED_SUCCESS' | 'FAILED_REFUND_NEEDED';
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(private readonly prisma: PrismaService) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    try {
      const order = await this.prisma.order.create({
        data: {
          ...createOrderDto,
          paymentRef: this.generatePaymentRef(),
        },
      });
      
      this.logger.log(`Created order with ID: ${order.id}`);
      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error creating order: ${err.message}`, err.stack);
      throw err;
    }
  }

  async findByPaymentRef(paymentRef: string) {
    return this.prisma.order.findUnique({
      where: { paymentRef },
      include: { user: true },
    });
  }

  async findById(id: string) {
    return this.prisma.order.findUnique({
      where: { id },
      include: { user: true },
    });
  }

  async findByUserId(userId: string) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
    });
  }

  async updateOrderStatus(id: string, status: any, txHash?: string) {
    return this.prisma.order.update({
      where: { id },
      data: {
        status,
        ...(txHash && { txHash }),
      },
    });
  }

  private generatePaymentRef(): string {
    const timestamp = Date.now().toString(36);
    const randomStr = Math.random().toString(36).substring(2, 9);
    return `GAS-${timestamp}-${randomStr}`.toUpperCase();
  }
}