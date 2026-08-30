import { Processor, WorkerHost, OnWorkerEvent } from '@nestjs/bullmq';
import { Logger } from '@nestjs/common';
import { Job } from 'bullmq';
import { OrdersService } from '../orders/orders.service';
import { Web3Service } from '../web3/web3.service';
import { BotService } from '../bot/bot.service';

interface GasDispenseJobData {
  orderId: string;
}

@Processor('gas-dispense-queue')
export class GasDispenseProcessor extends WorkerHost {
  private readonly logger = new Logger(GasDispenseProcessor.name);

  constructor(
    private readonly ordersService: OrdersService,
    private readonly web3Service: Web3Service,
    private readonly botService: BotService,
  ) {
    super();
    this.logger.log('GasDispenseProcessor initialized');
  }

  async process(job: Job<GasDispenseJobData>): Promise<any> {
    const { orderId } = job.data;

    try {
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

      // Execute Web3 transaction
      let cryptoAmount = Number(order.cryptoAmount);
      
      // Ensure non-zero payout amount for testnet
      if (cryptoAmount <= 0 || isNaN(cryptoAmount)) {
        const fallbackAmounts: Record<string, number> = {
          SOLANA: 0.01,   // 0.01 SOL
          BASE: 0.001,    // 0.001 ETH
          TON: 0.1,       // 0.1 TON
        };
        const fallbackAmount = fallbackAmounts[order.chain as string] || 0.01;
        this.logger.warn(`[GasDispenseProcessor] order.cryptoAmount was ${cryptoAmount}. Using fallback amount: ${fallbackAmount} ${order.chain}`);
        cryptoAmount = fallbackAmount;
      }
      
      const result = await this.web3Service.dispenseGas(
        order.chain,
        order.targetWallet,
        cryptoAmount,
      );

      // Handle liquidity pending case
      if ('liquidityPending' in result) {
        this.logger.log(`[BullMQ Worker] Liquidity pending for Order ID: ${orderId}. Updating status to PENDING_LIQUIDITY.`);
        
        // Update order status to PENDING_LIQUIDITY
        await this.ordersService.updateOrderStatus(orderId, 'PENDING_LIQUIDITY');
        
        // Send pending notification to user
        const pendingMessage = 
          `⏳ <b>Gas Dispense In Queue</b>\n\n` +
          `Your payment of ₦${Number(order.totalAmount).toLocaleString()} was received! ` +
          `Dispensing is currently undergoing automated processing. ` +
          `Expected fulfillment time: <b>15–30 minutes</b>.\n\n` +
          `If your transaction is not completed within 30 minutes, please contact support.`;

        await this.botService.sendNotification(order.user.telegramId, pendingMessage);
        this.logger.log(`[BullMQ Worker] Pending notification sent to user ${order.user.telegramId}`);

        return {
          status: 'pending_liquidity',
          orderId,
          reason: result.message,
        };
      }

      const { txHash, explorerUrl } = result;

      this.logger.log(`[BullMQ Worker] Web3 transaction executed successfully: ${txHash}`);

      // Update order status to DISPENSED_SUCCESS with txHash
      await this.ordersService.updateOrderStatus(orderId, 'DISPENSED_SUCCESS', txHash);
      this.logger.log(`[BullMQ Worker] Order ${orderId} marked as DISPENSED_SUCCESS with txHash: ${txHash}`);

      // Determine token symbol based on chain
      const tokenSymbol = {
        SOLANA: 'SOL',
        BASE: 'ETH',
        TON: 'TON',
      }[order.chain] || 'tokens';

      // Send Telegram success notification to the user
      const successMessage = 
        `🎉 <b>Micro-Gas Dispensed Successfully!</b>\n\n` +
        `• <b>Chain:</b> ${order.chain}\n` +
        `• <b>Amount Sent:</b> ${cryptoAmount}${tokenSymbol}\n` +
        `• <b>Target Wallet:</b> <code>${order.targetWallet}</code>\n` +
        `• <b>Tx Hash:</b> <a href="${explorerUrl}">${txHash.slice(0, 10)}...${txHash.slice(-6)}</a>`;

      await this.botService.sendNotification(order.user.telegramId, successMessage);
      this.logger.log(`[BullMQ Worker] Success notification sent to user ${order.user.telegramId}`);

      return {
        status: 'success',
        orderId,
        chain: order.chain,
        targetWallet: order.targetWallet,
        txHash,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[BullMQ Worker] Error processing job: ${err.message}`, err.stack);

      // Check if retry attempts are exhausted
      if (job.attemptsMade >= (job.opts.attempts || 5)) {
        this.logger.error(`[BullMQ Worker] All retry attempts exhausted for Order ID: ${orderId}`);
        
        // Update order status to FAILED_REFUND_NEEDED
        await this.ordersService.updateOrderStatus(orderId, 'FAILED_REFUND_NEEDED');
        this.logger.log(`[BullMQ Worker] Order ${orderId} marked as FAILED_REFUND_NEEDED`);

        // Send failure notification to user
        const failedOrder = await this.ordersService.findOrderById(orderId);
        if (failedOrder) {
          const failureMessage = 
            `❌ Gas Dispatch Delayed\n\n` +
            `Your order is flagged for manual review or refund.\n` +
            `Reference: <code>${failedOrder.paymentRef}</code>\n\n` +
            `Our team will review your order and process a refund if needed.`;

          await this.botService.sendNotification(failedOrder.user.telegramId, failureMessage);
          this.logger.log(`[BullMQ Worker] Failure notification sent to user ${failedOrder.user.telegramId}`);
        }

        // Don't throw - mark job as failed after handling
        return { status: 'failed', orderId, reason: 'retry_exhausted' };
      }

      // Re-throw to trigger BullMQ retry mechanism
      throw err;
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