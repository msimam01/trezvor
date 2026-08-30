import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { OracleService } from '../oracle/oracle.service';

interface CreateOrderDto {
  userId: string;
  chain: 'SOLANA' | 'BASE' | 'TON';
  targetWallet: string;
  fiatAmountNaira: number;
  feeNaira: number;
  totalAmount: number;
  cryptoAmount: number;
  paymentGateway: 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY';
  status: 'PENDING_PAYMENT' | 'PAYMENT_VERIFIED' | 'DISPENSING_QUEUED' | 'PENDING_LIQUIDITY' | 'DISPENSED_SUCCESS' | 'FAILED_REFUND_NEEDED';
}

// Chain-specific fallback amounts for testnet
const CHAIN_FALLBACK_AMOUNTS: Record<'SOLANA' | 'BASE' | 'TON', number> = {
  SOLANA: 0.01,   // 0.01 SOL
  BASE: 0.001,    // 0.001 ETH
  TON: 0.1,       // 0.1 TON
};

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly oracleService: OracleService,
  ) {}

  async createOrder(createOrderDto: CreateOrderDto) {
    try {
      // Ensure cryptoAmount is a valid positive number
      let cryptoAmount = createOrderDto.cryptoAmount;
      
      if (cryptoAmount <= 0 || isNaN(cryptoAmount)) {
        // Use chain-specific fallback amount for testnet
        cryptoAmount = CHAIN_FALLBACK_AMOUNTS[createOrderDto.chain as keyof typeof CHAIN_FALLBACK_AMOUNTS] || 0.01;
        this.logger.warn(`[OrdersService] cryptoAmount was ${createOrderDto.cryptoAmount}. Using fallback: ${cryptoAmount} ${createOrderDto.chain}`);
      }

      const order = await this.prisma.order.create({
        data: {
          ...createOrderDto,
          cryptoAmount,
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

  /**
   * Create order with dynamic crypto amount calculation using Oracle
   * User pays exactly fiatAmountNaira (totalAmount), fee is deducted from crypto calculation
   */
  async createOrderWithOracle(
    userId: string,
    chain: 'SOLANA' | 'BASE' | 'TON',
    targetWallet: string,
    fiatAmountNaira: number,
    feeNaira: number,
    totalAmount: number,
    paymentGateway: 'PAYSTACK' | 'FLUTTERWAVE' | 'OPAY',
    status: 'PENDING_PAYMENT' | 'PAYMENT_VERIFIED' | 'DISPENSING_QUEUED' | 'PENDING_LIQUIDITY' | 'DISPENSED_SUCCESS' | 'FAILED_REFUND_NEEDED',
  ) {
    try {
      // Ensure totalAmount equals fiatAmountNaira (user pays exactly what they selected)
      // Fee is calculated internally and deducted from crypto calculation
      const actualTotalAmount = fiatAmountNaira;
      
      // Calculate fee if not provided (5% capped at ₦200)
      const actualFeeNaira = feeNaira || Math.min(fiatAmountNaira * 0.05, 200);
      
      // Calculate crypto amount using Oracle service (fee is deducted internally)
      const { cryptoAmount } = await this.oracleService.calculateCryptoAmount(
        fiatAmountNaira,
        chain
      );

      const order = await this.prisma.order.create({
        data: {
          userId,
          chain,
          targetWallet,
          fiatAmountNaira,
          feeNaira: actualFeeNaira,
          totalAmount: actualTotalAmount,
          cryptoAmount,
          paymentGateway,
          status,
          paymentRef: this.generatePaymentRef(),
        },
      });
      
      this.logger.log(`Created order with ID: ${order.id} - User pays: ₦${actualTotalAmount}, Fee: ₦${actualFeeNaira}, Crypto: ${cryptoAmount}`);
      return order;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error creating order with oracle: ${err.message}`, err.stack);
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

  async findOrderById(id: string) {
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

  async getUserOrders(userId: string, limit: number = 10) {
    return this.prisma.order.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: limit,
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