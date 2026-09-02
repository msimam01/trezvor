import { Injectable, Logger, UnauthorizedException, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import { InjectQueue } from '@nestjs/bullmq';
import { Queue } from 'bullmq';
import { OrdersService } from '../orders/orders.service';
import { PrismaService } from '../../prisma/prisma.service';
import { ReferralService } from '../referrals/referral.service';

interface PaystackInitializeResponse {
  status: boolean;
  message: string;
  data: {
    authorization_url: string;
    access_code: string;
    reference: string;
  };
}

interface PaystackWebhookEvent {
  event: string;
  data: {
    reference: string;
    amount: number;
    customer: {
      email: string;
    };
    metadata: {
      orderId: string;
      userId: string;
      chain: string;
      targetWallet: string;
    };
  };
}

@Injectable()
export class PaymentsService {
  private readonly logger = new Logger(PaymentsService.name);
  private readonly paystackSecretKey: string;
  private readonly paystackApiUrl = 'https://api.paystack.co/transaction/initialize';

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
    private readonly prisma: PrismaService,
    @InjectQueue('gas-dispense-queue') private readonly gasQueue: Queue,
    private readonly referralService: ReferralService,
  ) {
    this.paystackSecretKey = this.configService.get<string>('PAYSTACK_SECRET_KEY') || '';
    if (!this.paystackSecretKey) {
      throw new Error('PAYSTACK_SECRET_KEY is not defined in environment variables');
    }
  }

  async initializePaystackTransaction(orderId: string) {
    try {
      // Fetch order by ID
      const order = await this.ordersService.findById(orderId);
      
      if (!order) {
        throw new Error('Order not found');
      }

      // Verify status is PENDING_PAYMENT
      if (order.status !== 'PENDING_PAYMENT') {
        throw new Error('Order is not in PENDING_PAYMENT status');
      }

      // Calculate amount in Kobo (Naira * 100)
      const totalAmountNaira = Number(order.totalAmount);
      const amountInKobo = Math.round(totalAmountNaira * 100);

      // Generate valid email for user (sanitize userId to ensure valid email)
      const sanitizedUserId = order.userId.replace(/[^a-zA-Z0-9]/g, '').substring(0, 50);
      const email = `user_${sanitizedUserId}@gasbot.app`;

      // Get callback URL from environment
      const appBaseUrl = this.configService.get<string>('APP_BASE_URL');
      const callbackUrl = `${appBaseUrl}/api/v1/payments/callback`;

      // Log request details for debugging
      this.logger.log(`Paystack initialization request:`, {
        email,
        amount: amountInKobo,
        reference: order.paymentRef,
        callbackUrl,
        metadata: {
          orderId: order.id,
          userId: order.userId,
          chain: order.chain,
          targetWallet: order.targetWallet,
        },
      });

      // Make POST request to Paystack
      const response = await firstValueFrom(
        this.httpService.post<PaystackInitializeResponse>(
          this.paystackApiUrl,
          {
            email,
            amount: amountInKobo,
            reference: order.paymentRef,
            callback_url: callbackUrl,
            metadata: {
              orderId: order.id,
              userId: order.userId,
              chain: order.chain,
              targetWallet: order.targetWallet,
            },
          },
          {
            headers: {
              Authorization: `Bearer ${this.paystackSecretKey}`,
              'Content-Type': 'application/json',
            },
          },
        ),
      );

      if (!response.data.status) {
        throw new Error(`Paystack initialization failed: ${response.data.message}`);
      }

      this.logger.log(`Paystack transaction initialized for order ${orderId}`);

      return {
        authorizationUrl: response.data.data.authorization_url,
        reference: order.paymentRef,
      };
    } catch (error) {
      const err = error as any;
      this.logger.error(`Error initializing Paystack transaction: ${err.message}`, err.stack);
      
      // Log additional Paystack error details if available
      if (err.response) {
        this.logger.error(`Paystack API response:`, {
          status: err.response.status,
          data: err.response.data,
        });
      }
      
      throw err;
    }
  }

  async verifyWebhookSignature(signature: string, body: any): Promise<boolean> {
    const crypto = require('crypto');
    const hmac = crypto.createHmac('sha512', this.paystackSecretKey);
    const digest = hmac.update(JSON.stringify(body)).digest('hex');
    return digest === signature;
  }

  async processPaystackWebhook(eventData: PaystackWebhookEvent) {
    try {
      const { event, data } = eventData;

      // Check for idempotency - verify if webhook was already processed
      const existingWebhookLog = await this.prisma.webhookLog.findUnique({
        where: { paymentRef: data.reference },
      });

      if (existingWebhookLog) {
        this.logger.log(`Webhook for reference ${data.reference} already processed. Ignoring duplicate.`);
        return { status: 'ignored_duplicate' };
      }

      // Save webhook log for idempotency
      await this.prisma.webhookLog.create({
        data: {
          paymentRef: data.reference,
          gateway: 'PAYSTACK',
          payload: eventData as any,
        },
      });

      // Process charge.success event
      if (event === 'charge.success') {
        // Fetch order by payment reference
        const order = await this.ordersService.findByPaymentRef(data.reference);

        if (!order) {
          this.logger.error(`Order not found for reference ${data.reference}`);
          return { status: 'error', message: 'Order not found' };
        }

        // Validate paid amount matches expected order total
        const expectedAmountKobo = Math.round(Number(order.totalAmount) * 100);
        if (data.amount !== expectedAmountKobo) {
          this.logger.error(
            `Amount mismatch for order ${order.id}. Expected: ${expectedAmountKobo}, Received: ${data.amount}`,
          );
          return { status: 'error', message: 'Amount mismatch' };
        }

        // Update order status to PAYMENT_VERIFIED
        await this.ordersService.updateOrderStatus(order.id, 'PAYMENT_VERIFIED');

        this.logger.log(`Order ${order.id} payment verified and status updated to PAYMENT_VERIFIED`);

        // Calculate platform fee using the feeNaira field directly
        const platformFeeNgn = Number(order.feeNaira);

        this.logger.log(`Order ${order.id} platform fee: ₦${platformFeeNgn} (feeNaira)`);

        // Process referral commission for transaction
        try {
          const commissionResult = await this.referralService.processTransactionCommission(
            order.id,
            platformFeeNgn,
          );

          if (commissionResult.success) {
            this.logger.log(`Referral commission processed successfully for order ${order.id}`);
          }
        } catch (commissionError) {
          this.logger.error(`Error processing referral commission for order ${order.id}:`, commissionError);
          // Don't fail the payment process if commission processing fails
        }

        // Process referral bonus for first deposit (if virtual accounts are enabled)
        try {
          const depositAmount = Number(order.totalAmount);
          const bonusResult = await this.referralService.processFirstDepositBonus(
            order.userId,
            depositAmount,
          );

          if (bonusResult.success) {
            this.logger.log(`Referral bonus processed successfully for order ${order.id}`);
          }
        } catch (bonusError) {
          this.logger.error(`Error processing referral bonus for order ${order.id}:`, bonusError);
          // Don't fail the payment process if bonus processing fails
        }

        // Dispatch job to queue for gas dispensing
        await this.gasQueue.add(
          'process-gas-payout',
          { orderId: order.id },
          {
            jobId: `order_${order.id}`, // Guarantees job uniqueness inside Redis
            attempts: 5,
            backoff: { type: 'exponential', delay: 3000 }, // Retry after 3s, 6s, 12s...
            removeOnComplete: true,
          },
        );

        this.logger.log(`Order ${order.id} dispatched to gas-dispense-queue`);

        return { status: 'success', orderId: order.id };
      }

      return { status: 'ignored_event' };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing Paystack webhook: ${err.message}`, err.stack);
      throw err;
    }
  }
}