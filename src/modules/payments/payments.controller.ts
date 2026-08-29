import { Controller, Get, Post, Param, Body, Headers, Query, UnauthorizedException, Logger, Res, HttpStatus } from '@nestjs/common';
import { Response } from 'express';
import { PaymentsService } from './payments.service';
import { ConfigService } from '@nestjs/config';
import { OrdersService } from '../orders/orders.service';

@Controller('payments')
export class PaymentsController {
  private readonly logger = new Logger(PaymentsController.name);

  constructor(
    private readonly paymentsService: PaymentsService,
    private readonly configService: ConfigService,
    private readonly ordersService: OrdersService,
  ) {}

  @Post('initialize/:orderId')
  async initializePayment(@Param('orderId') orderId: string) {
    try {
      const result = await this.paymentsService.initializePaystackTransaction(orderId);
      return {
        success: true,
        data: result,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error initializing payment for order ${orderId}: ${err.message}`, err.stack);
      return {
        success: false,
        error: err.message,
      };
    }
  }

  @Post('webhook/paystack')
  async handlePaystackWebhook(
    @Body() body: any,
    @Headers('x-paystack-signature') signature: string,
  ) {
    try {
      // Verify webhook signature
      if (!signature) {
        throw new UnauthorizedException('Missing webhook signature');
      }

      const isValidSignature = await this.paymentsService.verifyWebhookSignature(signature, body);
      if (!isValidSignature) {
        throw new UnauthorizedException('Invalid webhook signature');
      }

      this.logger.log('Paystack webhook signature verified successfully');

      // Process webhook event
      const result = await this.paymentsService.processPaystackWebhook(body);

      // If payment was successful, send Telegram notification
      if (result.status === 'success' && result.orderId) {
        await this.sendPaymentSuccessNotification(body.data, result.orderId);
      }

      return result;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing Paystack webhook: ${err.message}`, err.stack);
      
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      return {
        status: 'error',
        message: err.message,
      };
    }
  }

  private async sendPaymentSuccessNotification(paymentData: any, orderId: string) {
    try {
      const { metadata, amount } = paymentData;
      const totalAmountNaira = (amount / 100).toLocaleString();
      
      const message =
        `✅ **Payment Received!**\n\n` +
        `Your payment of ₦${totalAmountNaira} for ${metadata.chain} micro-gas has been confirmed. ` +
        `Processing transfer to wallet: \`${metadata.targetWallet}\`...`;

      // Log the notification for now
      this.logger.log(`Payment success notification for order ${orderId}: ${message}`);
      
      // TODO: Implement actual Telegram notification via BotService
      // This would require integrating with the BotService to send messages to specific users
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error sending payment success notification: ${err.message}`, err.stack);
    }
  }

  @Get('callback')
  async handlePaymentCallback(
    @Query('trxref') trxref: string,
    @Query('reference') reference: string,
    @Res() res: Response,
  ) {
    try {
      // Extract reference from either parameter
      const paymentRef = trxref || reference;
      
      if (!paymentRef) {
        return res.status(HttpStatus.BAD_REQUEST).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Payment Error</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; padding: 20px; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px; width: 100%; }
                .error { color: #ef4444; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2 class="error">❌ Invalid Request</h2>
                <p>No payment reference found in the callback.</p>
              </div>
            </body>
          </html>
        `);
      }

      // Query order by payment reference
      const order = await this.ordersService.findByPaymentRef(paymentRef);
      
      if (!order) {
        return res.status(HttpStatus.NOT_FOUND).send(`
          <!DOCTYPE html>
          <html>
            <head>
              <title>Order Not Found</title>
              <meta name="viewport" content="width=device-width, initial-scale=1.0">
              <style>
                body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; padding: 20px; }
                .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px; width: 100%; }
                .error { color: #ef4444; }
              </style>
            </head>
            <body>
              <div class="card">
                <h2 class="error">❌ Order Not Found</h2>
                <p>Unable to find order with reference: ${paymentRef}</p>
              </div>
            </body>
          </html>
        `);
      }

      // Get Telegram bot username
      const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME');
      // Construct deep-link URL with order ID for instant status display
      const botUrl = `https://t.me/${botUsername}?start=order_${order.id}`;

      // Return success HTML page with auto-redirect using deep link
      return res.status(HttpStatus.OK).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payment Successful</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; padding: 20px; }
              .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px; width: 100%; }
              .btn { display: inline-block; margin-top: 20px; padding: 12px 24px; background: #22c55e; color: white; text-decoration: none; border-radius: 8px; font-weight: bold; }
              .spinner { border: 3px solid rgba(255,255,255,0.3); border-top: 3px solid #22c55e; border-radius: 50%; width: 40px; height: 40px; animation: spin 1s linear infinite; margin: 20px auto; }
              @keyframes spin { 0% { transform: rotate(0deg); } 100% { transform: rotate(360deg); } }
            </style>
          </head>
          <body>
            <div class="card">
              <h2>✅ Payment Received!</h2>
              <div class="spinner"></div>
              <p>Your gas dispatch is being processed in the background.</p>
              <a class="btn" href="${botUrl}">Return to Telegram Bot</a>
            </div>
            <script>
              setTimeout(() => {
                window.location.href = "${botUrl}";
              }, 2500);
            </script>
          </body>
        </html>
      `);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing payment callback: ${err.message}`, err.stack);
      
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).send(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>Payment Error</title>
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <style>
              body { font-family: -apple-system, sans-serif; display: flex; flex-direction: column; align-items: center; justify-content: center; height: 100vh; margin: 0; background: #0f172a; color: white; text-align: center; padding: 20px; }
              .card { background: #1e293b; padding: 30px; border-radius: 12px; box-shadow: 0 4px 20px rgba(0,0,0,0.3); max-width: 400px; width: 100%; }
              .error { color: #ef4444; }
            </style>
            </head>
            <body>
              <div class="card">
                <h2 class="error">❌ Processing Error</h2>
                <p>An error occurred while processing your payment callback.</p>
              </div>
            </body>
          </html>
      `);
    }
  }
}