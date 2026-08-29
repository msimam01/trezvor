import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrdersService } from '../orders/orders.service';

interface GasDispenseJobData {
  orderId: string;
}

@Processor('gas-dispense-queue')
export class GasDispenseProcessor extends WorkerHost {
  private readonly logger = new Logger(GasDispenseProcessor.name);

  constructor(
    private readonly ordersService: OrdersService,
  ) {
    super();
    this.logger.log('GasDispenseProcessor initialized');
  }

  async process(job: Job<GasDispenseJobData>): Promise<any> {
    try {
      const { orderId } = job.data;

      this.logger.log(`[BullMQ Worker] Starting gas payout processing for Order ID: ${orderId}`);

      // Retrieve order details
      const order = await this.ordersService.findOrderById(orderId);

      if (!order) {
        this.logger.error(`[BullMQ Worker] Order not found: ${orderId}`);
        throw new Error(`Order not found: ${orderId}`);
      }

      // Idempotency check: if already dispensed, exit gracefully
      if (order.status === 'DISPENSED_SUCCESS') {
        this.logger.log(`[BullMQ Worker] Order ${orderId} already marked as DISPENSED_SUCCESS. Skipping processing.`);
        return { status: 'skipped', reason: 'already_dispensed' };
      }

      // Update order status to DISPENSING_QUEUED
      await this.ordersService.updateOrderStatus(orderId, 'DISPENSING_QUEUED');
      this.logger.log(`[BullMQ Worker] Order ${orderId} status updated to DISPENSING_QUEUED`);

      // Log execution clearly
      this.logger.log(
        `[BullMQ Worker] Processing gas payout for Order ID: ${orderId} on ${order.chain}`,
      );

      // TODO: Module 6 will execute Web3 RPC transactions here
      // For now, we'll simulate the processing and mark as success
      this.logger.log(`[BullMQ Worker] Web3 transaction execution will be implemented in Module 6`);

      // Simulate processing time (remove in production)
      await new Promise(resolve => setTimeout(resolve, 2000));

      // Update order status to DISPENSED_SUCCESS (temporary - will be done in Module 6)
      await this.ordersService.updateOrderStatus(orderId, 'DISPENSED_SUCCESS');
      this.logger.log(`[BullMQ Worker] Order ${orderId} marked as DISPENSED_SUCCESS`);

      return {
        status: 'success',
        orderId,
        chain: order.chain,
        targetWallet: order.targetWallet,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[BullMQ Worker] Error processing job: ${err.message}`, err.stack);
      throw err; // Re-throw to trigger BullMQ retry mechanism
    }
  }

  @OnWorkerEvent('completed')
  onCompleted(job: Job<GasDispenseJobData, any>) {
    this.logger.log(`[BullMQ Worker] Job completed for Order ID: ${job.data.orderId}`);
  }

  @OnWorkerEvent('failed')
  onFailed(job: Job<GasDispenseJobData>, error: Error) {
    this.logger.error(
      `[BullMQ Worker] Job failed for Order ID: ${job.data.orderId}. Error: ${error.message}`,
    );
  }
}