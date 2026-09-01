import { Injectable, Logger } from '@nestjs/common';
import { Inject } from '@nestjs/common';
import { MailerService } from '@nestjs-modules/mailer';
import { ConfigService } from '@nestjs/config';
import { SupportedChain } from '@prisma/client';

@Injectable()
export class MailService {
  private readonly logger = new Logger(MailService.name);
  private readonly adminEmail: string;

  constructor(
    private readonly mailerService: MailerService,
    private readonly configService: ConfigService,
  ) {
    this.adminEmail = this.configService.get<string>('ADMIN_EMAIL') || 'admin@gasbot.com';
  }

  /**
   * Send low balance alert to admin
   */
  async sendLowBalanceAlert(
    chain: SupportedChain,
    requiredAmount: number,
    currentBalance: number
  ): Promise<void> {
    try {
      const subject = `🚨 Low Balance Alert - ${chain} Vault`;
      
      const tokenSymbol = {
        SOLANA: 'SOL',
        BASE: 'ETH',
        TON: 'TON',
      }[chain] || 'tokens';

      const html = `
        <h2>🚨 Low Balance Alert</h2>
        <p><strong>Chain:</strong> ${chain}</p>
        <p><strong>Current Balance:</strong> ${currentBalance} ${tokenSymbol}</p>
        <p><strong>Required Amount:</strong> ${requiredAmount} ${tokenSymbol}</p>
        <p><strong>Deficit:</strong> ${(requiredAmount - currentBalance).toFixed(6)} ${tokenSymbol}</p>
        <hr>
        <p><strong>Action Required:</strong> Please refill the ${chain} vault to continue processing gas dispense orders.</p>
        <p><em>This is an automated alert from Trezvor Backend.</em></p>
      `;

      await this.mailerService.sendMail({
        to: this.adminEmail,
        subject,
        html,
      });

      this.logger.log(`Low balance alert sent for ${chain}: ${currentBalance} ${tokenSymbol} < ${requiredAmount} ${tokenSymbol}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send low balance alert: ${err.message}`);
      // Don't throw - email failures shouldn't break the main flow
    }
  }

  /**
   * Send general admin notification
   */
  async sendAdminNotification(subject: string, message: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to: this.adminEmail,
        subject: `[GasBot Admin] ${subject}`,
        html: `
          <h2>${subject}</h2>
          <p>${message}</p>
          <hr>
          <p><em>This is an automated notification from GasBot Backend.</em></p>
        `,
      });

      this.logger.log(`Admin notification sent: ${subject}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send admin notification: ${err.message}`);
    }
  }

  /**
   * Send email to any recipient
   */
  async sendEmail(to: string, subject: string, message: string): Promise<void> {
    try {
      await this.mailerService.sendMail({
        to,
        subject,
        html: `
          <h2>${subject}</h2>
          <p>${message}</p>
          <hr>
          <p><em>This is an automated notification from GasBot Backend.</em></p>
        `,
      });

      this.logger.log(`Email sent to ${to}: ${subject}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send email to ${to}: ${err.message}`);
    }
  }
}