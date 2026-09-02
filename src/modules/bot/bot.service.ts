import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { firstValueFrom } from 'rxjs';
import { Bot, session, InlineKeyboard, Context, SessionFlavor } from 'grammy';
import {
  BotCallbackAction,
  BotCallbackChain,
  BotCallbackAmount,
  BotCallbackCryptoAsset,
  BotCallbackPayoutDestination,
  BotSessionStep,
  AMOUNT_NAIRA_MAP,
  CHAIN_DISPLAY_NAMES
} from './bot.constants';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { PaymentsService } from '../payments/payments.service';
import { OracleService } from '../oracle/oracle.service';
import { OfframpService } from '../offramp/offramp.service';
import { validateWalletAddress, getValidationErrorMessage, ChainType } from './helpers/wallet-validator';
import { getExplorerUrl } from '../web3/helpers/explorer.helper';
import { PrismaService } from '../../prisma/prisma.service';
import { WalletService } from '../wallet/wallet.service';

interface BotSessionData {
  step: BotSessionStep;
  selectedChain: 'SOLANA' | 'BASE' | 'TON' | null;
  selectedAmountNaira: number | null;
  userId: string | null; // Store the User UUID for order creation
  lastOrderId: string | null; // Store the last created order ID for payment
  sellCryptoAsset: 'USDT' | 'TON' | 'SOL' | null;
  sellCryptoAmount: number | null;
  sellTxId: string | null;
  selectedBankCode: string | null; // For bank selection
  withdrawalAmount: number | null; // For withdrawal flow
  withdrawalBankId: string | null; // For withdrawal flow
  addBankFlow: boolean; // Track if user is in add bank flow
}

type BotContext = Context & SessionFlavor<BotSessionData>;

@Injectable()
export class BotService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(BotService.name);
  private bot: Bot<BotContext>;
  private readonly botToken: string;

  constructor(
    private readonly configService: ConfigService,
    private readonly usersService: UsersService,
    private readonly ordersService: OrdersService,
    private readonly settingsService: SettingsService,
    private readonly paymentsService: PaymentsService,
    private readonly oracleService: OracleService,
    private readonly prisma: PrismaService,
    private readonly httpService: HttpService,
    private readonly offrampService: OfframpService,
    private readonly walletService: WalletService,
  ) {
    this.botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN') || '';
    if (!this.botToken) {
      throw new Error('TELEGRAM_BOT_TOKEN is not defined in environment variables');
    }
    
    this.bot = new Bot<BotContext>(this.botToken);
    this.setupBot();
  }

  private setupBot() {
    // Add session middleware
    this.bot.use(session({
      initial: (): BotSessionData => ({
        step: BotSessionStep.IDLE,
        selectedChain: null,
        selectedAmountNaira: null,
        userId: null,
        lastOrderId: null,
        sellCryptoAsset: null,
        sellCryptoAmount: null,
        sellTxId: null,
        selectedBankCode: null,
        withdrawalAmount: null,
        withdrawalBankId: null,
        addBankFlow: false,
      }),
    }));

    // Register command handlers
    this.bot.command('start', this.handleStart.bind(this));
    this.bot.command('buygas', this.handleBuyGasCommand.bind(this));
    this.bot.command('orders', this.handleMyOrdersCommand.bind(this));
    this.bot.command('help', this.handleHelpCommand.bind(this));
    this.bot.command('home', this.handleHomeCommand.bind(this));
    this.bot.command('link', this.handleLinkCommand.bind(this));
    this.bot.command('ref', this.handleReferralCommand.bind(this));
    this.bot.command('ping', this.handlePingCommand.bind(this));
    this.bot.command('bank', this.handleBankCommand.bind(this));
    this.bot.command('wallet', this.handleWalletCommand.bind(this));

    // Register callback query handlers
    this.bot.callbackQuery(BotCallbackAction.ACTION_BUY_GAS, this.handleBuyGas.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_MY_ORDERS, this.handleMyOrders.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_HELP, this.handleHelp.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_BACK, this.handleBack.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_HOME, this.handleHome.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_PAY_NOW, this.handlePayNow.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_CANCEL_ORDER, this.handleCancelOrder.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_SELL_CRYPTO, this.handleSellCrypto.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_BANK, this.handleBank.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_WALLET, this.handleWallet.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_WITHDRAW, this.handleWithdraw.bind(this));

    // Chain selection handlers
    this.bot.callbackQuery(BotCallbackChain.CHAIN_SOLANA, this.handleChainSelection.bind(this));
    this.bot.callbackQuery(BotCallbackChain.CHAIN_BASE, this.handleChainSelection.bind(this));
    this.bot.callbackQuery(BotCallbackChain.CHAIN_TON, this.handleChainSelection.bind(this));

    // Amount selection handlers
    this.bot.callbackQuery(BotCallbackAmount.AMT_1000, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_2500, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_5000, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_CUSTOM, this.handleCustomAmount.bind(this));

    // Crypto asset selection handlers for off-ramp (USDT only now)
    // this.bot.callbackQuery(BotCallbackCryptoAsset.CRYPTO_USDT, this.handleCryptoAssetSelection.bind(this));
    // this.bot.callbackQuery(BotCallbackCryptoAsset.CRYPTO_TON, this.handleCryptoAssetSelection.bind(this));
    // this.bot.callbackQuery(BotCallbackCryptoAsset.CRYPTO_SOL, this.handleCryptoAssetSelection.bind(this));

    // Payout destination handlers for off-ramp
    this.bot.callbackQuery(BotCallbackPayoutDestination.PAYOUT_INTERNAL_WALLET, this.handlePayoutDestination.bind(this));
    this.bot.callbackQuery(BotCallbackPayoutDestination.PAYOUT_SAVED_BANK, this.handlePayoutDestination.bind(this));

    // Bank selection handler for off-ramp
    this.bot.callbackQuery(/^BANK_SELECT_/, this.handleBankSelection.bind(this));
    
    // Bank selection handler for adding bank accounts
    this.bot.callbackQuery(/^BANK_CODE_/, this.handleBankCodeSelection.bind(this));

    // Message handler for wallet address
    this.bot.on('message:text', this.handleTextMessage.bind(this));
    
    // Generic message handler for other message types
    this.bot.on('message', this.handleGenericMessage.bind(this));

    // Error handling
    this.bot.catch((err) => {
      this.logger.error(`Bot error: ${err.message}`, err.stack);
    });
  }

  private async handleStart(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const username = ctx.from.username;
      const firstName = ctx.from.first_name;

      // Deep Link Handling: e.g., /start REF_CODE or /start order_UUID
      const payload = ctx.match; // Captures deep-link parameter after ?start=
      
      let referralCode: string | undefined;
      
      if (payload && typeof payload === 'string') {
        // Check if it's a referral code (not an order UUID)
        if (!payload.startsWith('order_')) {
          referralCode = payload.trim();
          this.logger.log(`User ${telegramId} started with referral code: ${referralCode}`);
        }
      }

      // Find or create user with referral code if provided
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username,
        firstName,
        referralCode,
      });

      // Reset session and store userId
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.selectedChain = null;
      ctx.session.selectedAmountNaira = null;
      ctx.session.userId = user.id;

      // Deep Link Handling: e.g., /start order_UUID
      if (payload && typeof payload === 'string' && payload.startsWith('order_')) {
        const orderId = payload.replace('order_', '').trim();
        const order = await this.ordersService.findOrderById(orderId);

        if (order) {
          const statusEmoji = {
            PENDING_PAYMENT: '⏳',
            PAYMENT_VERIFIED: '✅',
            DISPENSING_QUEUED: '⚙️',
            PENDING_LIQUIDITY: '⏳',
            DISPENSED_SUCCESS: '🎉',
            FAILED_REFUND_NEEDED: '❌',
            REFUNDED: '💸',
          }[order.status] || 'ℹ️';

          const message = 
            `${statusEmoji} <b>Order Status: ${order.status}</b>\n\n` +
            `• <b>Chain:</b> ${order.chain}\n` +
            `• <b>Amount Paid:</b> ₦${order.totalAmount}\n` +
            `• <b>Target Wallet:</b> <code>${order.targetWallet}</code>\n` +
            `• <b>Ref:</b> <code>${order.paymentRef}</code>\n\n` +
            (order.status === 'PAYMENT_VERIFIED' || order.status === 'DISPENSING_QUEUED' 
              ? '🚀 Your crypto is currently being queued for on-chain transfer!' 
              : 'Tap below to return to main menu.');

          const keyboard = new InlineKeyboard()
            .text('🏠 Main Menu', BotCallbackAction.ACTION_HOME);

          await ctx.reply(message, {
            parse_mode: 'HTML',
            reply_markup: keyboard,
          });
          return;
        }
      }

      // Fallback to standard Main Menu if no payload or order not found
      await this.sendMainMenu(ctx, firstName || 'User');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /start handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleBuyGas(ctx: BotContext) {
    try {
      // Ensure userId is set before proceeding
      if (!ctx.session.userId && ctx.from) {
        const telegramId = BigInt(ctx.from.id);
        const user = await this.usersService.findOrCreateUser({
          telegramId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
        });
        ctx.session.userId = user.id;
      }

      ctx.session.step = BotSessionStep.SELECT_CHAIN;
      ctx.session.selectedChain = null;
      ctx.session.selectedAmountNaira = null;

      // Get enabled chains dynamically
      const enabledChains = await this.settingsService.getAllEnabledChains();
      
      // Build keyboard with only enabled chains
      const keyboard = new InlineKeyboard();
      
      // Map supported chains to callback chains
      const chainMapping: Record<string, BotCallbackChain> = {
        'SOLANA': BotCallbackChain.CHAIN_SOLANA,
        'BASE': BotCallbackChain.CHAIN_BASE,
        'TON': BotCallbackChain.CHAIN_TON,
      };
      
      enabledChains.forEach((chain, index) => {
        const chainCallback = chainMapping[chain];
        if (chainCallback) {
          keyboard.text(CHAIN_DISPLAY_NAMES[chainCallback], chainCallback);
          if ((index + 1) % 3 === 0 || index === enabledChains.length - 1) {
            keyboard.row();
          }
        }
      });
      
      keyboard.text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = 'Select the blockchain network:';

      // Check if this is a callback query or a regular command
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { reply_markup: keyboard });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { reply_markup: keyboard });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_BUY_GAS handler: ${err.message}`, err.stack);
      
      // Only answer callback query if this is a callback
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleMyOrders(ctx: BotContext) {
    try {
      // Ensure userId is set
      if (!ctx.session.userId && ctx.from) {
        const telegramId = BigInt(ctx.from.id);
        const user = await this.usersService.findOrCreateUser({
          telegramId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
        });
        ctx.session.userId = user.id;
      }

      if (!ctx.session.userId) {
        const message = 'Unable to identify user. Please start over with /start';
        if (ctx.callbackQuery) {
          await ctx.editMessageText(message);
          await ctx.answerCallbackQuery();
        } else {
          await ctx.reply(message);
        }
        return;
      }

      // Fetch last 5 orders for the user
      const orders = await this.ordersService.getUserOrders(ctx.session.userId, 5);

      if (orders.length === 0) {
        const keyboard = new InlineKeyboard()
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);

        const message = '📦 <b>My Orders</b>\n\nYou haven\'t placed any gas orders yet!\n\nClick "Buy Micro-Gas" to get started.';
        
        if (ctx.callbackQuery) {
          await ctx.editMessageText(message, { 
            parse_mode: 'HTML',
            reply_markup: keyboard 
          });
          await ctx.answerCallbackQuery();
        } else {
          await ctx.reply(message, { 
            parse_mode: 'HTML',
            reply_markup: keyboard 
          });
        }
        return;
      }

      // Format orders with status emojis
      const statusEmoji = {
        PENDING_PAYMENT: '⏳',
        PAYMENT_VERIFIED: '✅',
        DISPENSING_QUEUED: '⚙️',
        PENDING_LIQUIDITY: '⏳',
        DISPENSED_SUCCESS: '🎉',
        FAILED_REFUND_NEEDED: '❌',
        REFUNDED: '💸',
      };

      const tokenSymbol = {
        SOLANA: 'SOL',
        BASE: 'ETH',
        TON: 'TON',
      };

      let ordersText = `📦 <b>My Orders</b> (Last 5)\n\n`;

      orders.forEach((order, index) => {
        const emoji = statusEmoji[order.status] || 'ℹ️';
        const symbol = tokenSymbol[order.chain] || 'tokens';
        const date = new Date(order.createdAt).toLocaleDateString();
        
        ordersText += `${emoji} <b>Order #${index + 1}</b>\n`;
        ordersText += `📅 ${date} | 🔗 ${order.chain}\n`;
        ordersText += `💰 ₦${Number(order.totalAmount).toLocaleString()} → ~${Number(order.cryptoAmount).toFixed(6)} ${symbol}\n`;
        ordersText += `📝 Status: ${order.status}\n`;
        
        if (order.txHash) {
          const explorerUrl = getExplorerUrl(order.chain, order.txHash);
          ordersText += `🔗 <a href="${explorerUrl}">View Transaction</a>\n`;
        }
        
        ordersText += '\n';
      });

      const keyboard = new InlineKeyboard()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(ordersText, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(ordersText, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_MY_ORDERS handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleHelp(ctx: BotContext) {
    try {
      const helpText = 
        '❓ <b>Help & Support</b>\n\n' +
        '🤖 <b>How to use this bot:</b>\n' +
        '1. Click "Buy Crypto" to start a transaction\n' +
        '2. Select your preferred blockchain (Solana, Base, or TON)\n' +
        '3. Choose the amount you want to purchase\n' +
        '4. Provide your wallet address\n' +
        '5. Complete payment via the payment gateway\n' +
        '6. Receive your gas tokens automatically\n\n' +
        '❓ <b>Frequently Asked Questions:</b>\n\n' +
        '<b>⏱️ Transaction Delays:</b>\n' +
        '• Normal processing time: 5-15 minutes\n' +
        '• During high network congestion: up to 30 minutes\n' +
        '• If delayed beyond 30 minutes, contact support\n\n' +
        '<b>💼 Wallet Balance Guidance:</b>\n' +
        '• Ensure your wallet has enough gas for the transaction\n' +
        '• Solana: ~0.00001 SOL buffer recommended\n' +
        '• Base: ~0.0001 ETH buffer recommended\n' +
        '• TON: ~0.01 TON buffer recommended\n\n' +
        '🆘 <b>Need Support?</b>\n' +
        'Contact our support team: @YourGasBotSupport\n\n' +
        '📧 <b>Email Support:</b>\n' +
        'support@gasbot.com\n\n' +
        '⚡ <b>Quick Links:</b>\n' +
        '🏠 Home - Return to main menu\n' +
        '📦 My Orders - View your order history';
      
      const keyboard = new InlineKeyboard()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(helpText, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(helpText, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_HELP handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleChainSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        }
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      
      // Map callback to chain enum value
      const chainMap: Record<string, 'SOLANA' | 'BASE' | 'TON'> = {
        [BotCallbackChain.CHAIN_SOLANA]: 'SOLANA',
        [BotCallbackChain.CHAIN_BASE]: 'BASE',
        [BotCallbackChain.CHAIN_TON]: 'TON',
      };

      const selectedChain = chainMap[callbackData];
      if (!selectedChain) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid chain selection' });
        }
        return;
      }

      ctx.session.selectedChain = selectedChain;
      ctx.session.step = BotSessionStep.SELECT_AMOUNT;

      const keyboard = new InlineKeyboard()
        .text('₦1,000', BotCallbackAmount.AMT_1000)
        .text('₦2,500', BotCallbackAmount.AMT_2500)
        .text('₦5,000', BotCallbackAmount.AMT_5000)
        .row()
        .text('✍️ Custom Amount', BotCallbackAmount.AMT_CUSTOM)
        .row()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = `Select amount for ${CHAIN_DISPLAY_NAMES[callbackData as BotCallbackChain]}:`;
      
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { reply_markup: keyboard });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { reply_markup: keyboard });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in chain selection handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleAmountSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        }
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const amount = AMOUNT_NAIRA_MAP[callbackData as BotCallbackAmount];

      if (!amount) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid amount selection' });
        }
        return;
      }

      // Validate against minimum amount for selected chain
      const chain = ctx.session.selectedChain;
      if (chain) {
        const chainConfig = await this.settingsService.getChainConfig(chain as any);
        if (amount < chainConfig.minAmountNaira) {
          if (ctx.callbackQuery) {
            await ctx.answerCallbackQuery({ 
              text: `Minimum order for ${chain} is ₦${chainConfig.minAmountNaira}` 
            });
          }
          return;
        }
      }

      ctx.session.selectedAmountNaira = amount;
      ctx.session.step = BotSessionStep.AWAITING_WALLET;

      const chainName = ctx.session.selectedChain;
      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = `Please reply with your target wallet address for ${chainName}:`;
      
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { reply_markup: keyboard });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { reply_markup: keyboard });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in amount selection handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleCustomAmount(ctx: BotContext) {
    try {
      const chain = ctx.session.selectedChain;
      if (!chain) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Please select a chain first' });
        }
        return;
      }

      // Get chain config for minimum amount
      const chainConfig = await this.settingsService.getChainConfig(chain as any);
      
      ctx.session.step = BotSessionStep.AWAITING_CUSTOM_AMOUNT;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = `Enter custom Naira amount (Minimum for ${chain} is ₦${chainConfig.minAmountNaira}):`;
      
      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { reply_markup: keyboard });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { reply_markup: keyboard });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in custom amount handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleTextMessage(ctx: BotContext) {
    try {
      this.logger.log(`Received text message from user ${ctx.from?.id}: "${ctx.message?.text}"`);
      
      if (!ctx.message?.text) {
        await ctx.reply('Please provide valid input.');
        return;
      }

      const text = ctx.message.text.trim();

      // Handle custom amount input
      if (ctx.session.step === BotSessionStep.AWAITING_CUSTOM_AMOUNT) {
        await this.handleCustomAmountInput(ctx, text);
        return;
      }

      // Handle off-ramp amount input
      if (ctx.session.step === BotSessionStep.AWAITING_SELL_AMOUNT) {
        await this.handleSellAmountInput(ctx, text);
        return;
      }

      // Handle off-ramp transaction ID input
      if (ctx.session.step === BotSessionStep.AWAITING_SELL_TX_ID) {
        await this.handleSellTxIdInput(ctx, text);
        return;
      }

      // Handle bank account number input
      if (ctx.session.step === BotSessionStep.AWAITING_ACCOUNT_NUMBER) {
        await this.handleAccountNumberInput(ctx, text);
        return;
      }

      // Handle withdrawal amount input
      if (ctx.session.step === BotSessionStep.AWAITING_WITHDRAWAL_AMOUNT) {
        await this.handleWithdrawalAmountInput(ctx, text);
        return;
      }

      // Only process wallet address if we're awaiting wallet address
      if (ctx.session.step !== BotSessionStep.AWAITING_WALLET) {
        // User sent a message when not expecting input
        this.logger.log(`User ${ctx.from?.id} sent message in unexpected state: ${ctx.session.step}`);
        await ctx.reply('Please use the menu buttons or send /start to begin.');
        return;
      }

      const walletAddress = text;
      const chain = ctx.session.selectedChain;

      // Validate wallet address based on chain
      if (!validateWalletAddress(chain as ChainType, walletAddress)) {
        const errorMessage = getValidationErrorMessage(chain as ChainType);
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply(`❌ Invalid ${chain} address. ${errorMessage}\n\nPlease check and re-enter, or click Back.`, { reply_markup: keyboard });
        return;
      }

      // Get the user's selected amount (this is the total they will pay)
      const fiatAmount = ctx.session.selectedAmountNaira;
      if (!fiatAmount) {
        await ctx.reply('Invalid amount. Please start over with /start');
        return;
      }

      // Fee is calculated internally (5% capped at ₦200) and deducted from crypto calculation
      // User pays exactly fiatAmount total
      const feeNaira = Math.min(fiatAmount * 0.05, 200);
      const totalAmount = fiatAmount; // User pays exactly what they selected

      // Reset session but keep userId for potential future use
      const currentUserId = ctx.session.userId;
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.selectedChain = null;
      ctx.session.selectedAmountNaira = null;

      // Create order using the stored userId (UUID)
      if (!currentUserId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      // Calculate crypto amount using Oracle service
      const { cryptoAmount, rateNgn } = await this.oracleService.calculateCryptoAmount(
        fiatAmount,
        chain as any
      );

      const order = await this.ordersService.createOrder({
        userId: currentUserId,
        chain: chain as any,
        targetWallet: walletAddress,
        fiatAmountNaira: fiatAmount,
        feeNaira,
        totalAmount,
        cryptoAmount,
        paymentGateway: 'PAYSTACK' as any, // Default gateway
        status: 'PENDING_PAYMENT' as any,
      });

      // Store order ID in session for payment processing
      ctx.session.lastOrderId = order.id;

      // Determine token symbol
      const tokenSymbol = {
        SOLANA: 'SOL',
        BASE: 'ETH',
        TON: 'TON',
      }[chain || 'SOLANA'] || 'tokens';

      // Send order summary with estimated crypto output
      const summary =
        `💳 <b>Order Summary</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔗 <b>Chain:</b> ${chain}\n` +
        `💰 <b>Payment:</b> ₦${fiatAmount.toLocaleString()}\n` +
        `⚡ <b>Estimated Output:</b> ~${cryptoAmount}${tokenSymbol}\n` +
        `📈 <b>Rate:</b> ₦${rateNgn.toLocaleString()}/${tokenSymbol}\n` +
        `👛 <b>Wallet:</b> <code>${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 4)}</code>\n` +
        `📝 <b>Order ID:</b> <code>${order.id.substring(0, 8)}...</code>\n\n` +
        `Status: ⏳ Pending Payment`;

      const keyboard = new InlineKeyboard()
        .text('💳 Pay Now', BotCallbackAction.ACTION_PAY_NOW)
        .row()
        .text('❌ Cancel', BotCallbackAction.ACTION_CANCEL_ORDER);

      await ctx.reply(summary, { 
        parse_mode: 'HTML',
        reply_markup: keyboard 
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in text message handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again starting with /start');
    }
  }

  private async handleGenericMessage(ctx: BotContext) {
    try {
      // Handle non-text messages (photos, stickers, etc.)
      this.logger.log(`Received non-text message from user ${ctx.from?.id}`);
      
      const keyboard = new InlineKeyboard()
        .text('🏠 Main Menu', BotCallbackAction.ACTION_HOME);
      
      await ctx.reply('I can only process text messages. Please use the menu buttons or send a command like /start.', { reply_markup: keyboard });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in generic message handler: ${err.message}`, err.stack);
    }
  }

  private async handleSellAmountInput(ctx: BotContext, text: string) {
    try {
      // Parse numeric value
      const amount = parseFloat(text);
      
      // Validate numeric input
      if (isNaN(amount) || amount <= 0) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply('❌ Invalid amount. Please enter a valid number (e.g. 10).', { reply_markup: keyboard });
        return;
      }

      // Validate minimum amount (10 USDT)
      if (amount < 10) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply('❌ Minimum amount is 10 USDT. Please enter a higher amount.', { reply_markup: keyboard });
        return;
      }

      // Store the amount in the dedicated sell field
      ctx.session.sellCryptoAmount = amount;
      ctx.session.sellCryptoAsset = 'USDT'; // Only USDT is supported now
      
      // Calculate NGN value using admin settings
      const settings = await this.settingsService.getAdminSettings();
      const usdtBuyRate = settings.usdtBuyRateNgn || 1550.0;
      const ngnValue = amount * usdtBuyRate;

      // Show calculated value and proceed to transaction ID input
      ctx.session.step = BotSessionStep.AWAITING_SELL_TX_ID;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = 
        `💰 <b>USDT Off-Ramp</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💵 <b>Amount:</b> ${amount} USDT\n` +
        `💰 <b>NGN Value:</b> ₦${ngnValue.toLocaleString()}\n` +
        `📈 <b>Rate:</b> ₦${usdtBuyRate.toLocaleString()}/USDT\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Please enter your Bybit Transaction ID:`;

      await ctx.reply(message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard 
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in sell amount input handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleSellTxIdInput(ctx: BotContext, text: string) {
    try {
      const txId = text.trim();
      
      if (!txId || txId.length < 5) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply('❌ Invalid Transaction ID. Please enter a valid ID.', { reply_markup: keyboard });
        return;
      }

      // Store the transaction ID in the dedicated session field
      ctx.session.sellTxId = txId;
      
      // Show payout destination selection
      ctx.session.step = BotSessionStep.AWAITING_SELL_PAYOUT_CHOICE;

      const keyboard = new InlineKeyboard()
        .text('💰 Internal Wallet', BotCallbackPayoutDestination.PAYOUT_INTERNAL_WALLET)
        .text('🏦 Saved Bank', BotCallbackPayoutDestination.PAYOUT_SAVED_BANK)
        .row()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply('Select your payout destination:', { reply_markup: keyboard });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in sell Tx ID input handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleCustomAmountInput(ctx: BotContext, text: string) {
    try {
      const chain = ctx.session.selectedChain;
      if (!chain) {
        await ctx.reply('Please select a chain first.');
        return;
      }

      // Parse numeric value
      const amount = parseFloat(text);
      
      // Validate numeric input
      if (isNaN(amount) || amount <= 0) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply('❌ Invalid amount. Please enter a valid number (e.g. 800).', { reply_markup: keyboard });
        return;
      }

      // Get chain config for minimum amount validation
      const chainConfig = await this.settingsService.getChainConfig(chain as any);
      
      // Validate against minimum amount
      if (amount < chainConfig.minAmountNaira) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply(
          `❌ Minimum order for ${chain} is ₦${chainConfig.minAmountNaira}. Please enter a higher amount.`,
          { reply_markup: keyboard }
        );
        return;
      }

      // Store valid amount and proceed to wallet input
      ctx.session.selectedAmountNaira = amount;
      ctx.session.step = BotSessionStep.AWAITING_WALLET;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply(`Please reply with your target wallet address for ${chain}:`, { reply_markup: keyboard });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in custom amount input handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleAccountNumberInput(ctx: BotContext, text: string) {
    try {
      const accountNumber = text.trim();
      
      // Validate account number (10 digits)
      if (!/^\d{10}$/.test(accountNumber)) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply('❌ Invalid account number. Please enter a valid 10-digit NUBAN account number.', { reply_markup: keyboard });
        return;
      }

      if (!ctx.session.userId || !ctx.session.selectedBankCode) {
        await ctx.reply('Session expired. Please start over with /bank');
        return;
      }

      // Call wallet service to resolve and save bank
      const result = await this.walletService.resolveAndSaveBank(
        ctx.session.userId,
        accountNumber,
        ctx.session.selectedBankCode
      );

      // Reset session
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.selectedBankCode = null;
      ctx.session.addBankFlow = false;

      const message = 
        `✅ <b>Bank Account Added Successfully</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🏦 <b>Bank Name:</b> ${result.bankName}\n` +
        `📋 <b>Account Number:</b> ${accountNumber}\n` +
        `👤 <b>Account Name:</b> ${result.accountName}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Your bank account has been saved and is ready for withdrawals.`;

      const keyboard = new InlineKeyboard()
        .text('💰 My Wallet', BotCallbackAction.ACTION_WALLET)
        .row()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply(message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard 
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in account number input handler: ${err.message}`, err.stack);
      
      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);
      
      await ctx.reply(`❌ Failed to resolve account: ${err.message}. Please check the account number and try again.`, { reply_markup: keyboard });
    }
  }

  private async handleWithdrawalAmountInput(ctx: BotContext, text: string) {
    try {
      const amount = parseFloat(text);
      
      // Validate numeric input
      if (isNaN(amount) || amount <= 0) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply('❌ Invalid amount. Please enter a valid number (e.g. 1000).', { reply_markup: keyboard });
        return;
      }

      if (!ctx.session.userId) {
        await ctx.reply('Session expired. Please start over with /wallet');
        return;
      }

      // Check wallet balance
      const walletData = await this.walletService.getWalletBalance(ctx.session.userId);
      
      if (amount > walletData.nairaBalance) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);
        
        await ctx.reply(`❌ Insufficient balance. Your available balance is ₦${walletData.formattedBalance}`, { reply_markup: keyboard });
        return;
      }

      // Get saved banks for selection
      if (walletData.savedBanks.length === 0) {
        await ctx.reply('No saved bank accounts found. Please add a bank account first.');
        await this.handleBank(ctx);
        return;
      }

      ctx.session.withdrawalAmount = amount;
      ctx.session.step = BotSessionStep.AWAITING_WITHDRAWAL_BANK;

      // Build keyboard with saved banks
      const keyboard = new InlineKeyboard();
      walletData.savedBanks.forEach((bank, index) => {
        keyboard.text(`${bank.bankName} - ${bank.accountNumber}`, `BANK_SELECT_${bank.id}`);
        if ((index + 1) % 2 === 0 || index === walletData.savedBanks.length - 1) {
          keyboard.row();
        }
      });
      keyboard.text('⬅️ Back', BotCallbackAction.ACTION_BACK);
      keyboard.text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = `Select bank account for withdrawal of ₦${amount.toLocaleString()}:`;

      await ctx.reply(message, { reply_markup: keyboard });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in withdrawal amount input handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleBuyGasCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const username = ctx.from.username;
      const firstName = ctx.from.first_name;

      // Find or create user and store userId
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username,
        firstName,
      });

      ctx.session.userId = user.id;
      await this.handleBuyGas(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /buygas command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleMyOrdersCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const username = ctx.from.username;
      const firstName = ctx.from.first_name;

      // Find or create user and store userId
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username,
        firstName,
      });

      ctx.session.userId = user.id;
      await this.handleMyOrders(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /orders command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleHelpCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const username = ctx.from.username;
      const firstName = ctx.from.first_name;

      // Find or create user and store userId
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username,
        firstName,
      });

      ctx.session.userId = user.id;
      await this.handleHelp(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /help command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleHomeCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const username = ctx.from.username;
      const firstName = ctx.from.first_name;

      // Find or create user and store userId
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username,
        firstName,
      });

      ctx.session.userId = user.id;
      await this.sendMainMenu(ctx, firstName);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /home command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleLinkCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = ctx.from.id.toString();

      // Generate 6-digit alphanumeric code

      // Generate 6-digit alphanumeric code
      const numericPart = Math.floor(100000 + Math.random() * 900000).toString();
      const code = `G-${numericPart}`;

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
        const finalCode = existingCode.code;
        const expiresAtMinutes = Math.ceil((existingCode.expiresAt.getTime() - Date.now()) / (1000 * 60));

        const message =
          `🔗 <b>Account Linking</b>\n\n` +
          `Your account linking code is:\n\n` +
          `<code>${finalCode.replace('G-', '')}</code>\n\n` +
          `Enter this code on your Web Dashboard under Profile Settings within ${expiresAtMinutes} minutes.\n\n` +
          `⚠️ This code will expire in ${expiresAtMinutes} minutes.\n` +
          `📱 Don't share this code with anyone!`;

        const keyboard = new InlineKeyboard()
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);

        await ctx.reply(message, {
          parse_mode: 'HTML',
          reply_markup: keyboard,
        });
        return;
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

      // Format expiration time
      const expiresAtDate = linkCode.expiresAt;
      const expiresAtMinutes = Math.ceil((expiresAtDate.getTime() - Date.now()) / (1000 * 60));

      const message =
        `🔗 <b>Account Linking</b>\n\n` +
        `Your account linking code is:\n\n` +
        `<code>${code.replace('G-', '')}</code>\n\n` +
        `Enter this code on your Web Dashboard under Profile Settings within ${expiresAtMinutes} minutes.\n\n` +
        `⚠️ This code will expire in ${expiresAtMinutes} minutes.\n` +
        `📱 Don't share this code with anyone!`;

      const keyboard = new InlineKeyboard()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /link command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong generating your link code. Please try again.');
    }
  }

  private async handlePingCommand(ctx: BotContext) {
    try {
      this.logger.log(`Ping command received from user ${ctx.from?.id}`);
      await ctx.reply('🏓 Pong! Bot is working correctly.');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /ping command: ${err.message}`, err.stack);
    }
  }

  private async handleReferralCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const user = await this.usersService.findByTelegramId(telegramId);

      if (!user) {
        await ctx.reply('User not found. Please start with /start');
        return;
      }

      // Get referral stats from backend
      const response = await this.httpService.axiosRef.get(
        `${this.configService.get<string>('APP_BASE_URL')}/api/v1/referrals/public/stats/${user.id}`
      );

      const stats = response.data.data;

      const botUsername = this.configService.get<string>('TELEGRAM_BOT_USERNAME') || 'GasBot';
      const referralLink = `https://t.me/${botUsername}?start=${user.referralCode}`;

      const message =
        `🎁 <b>Your Referral Stats</b>\n\n` +
        `📋 <b>Referral Code:</b> <code>${user.referralCode}</code>\n` +
        `🔗 <b>Referral Link:</b> ${referralLink}\n\n` +
        `👥 <b>Total Referred:</b> ${stats.totalReferred}\n` +
        `💰 <b>Pending Bonuses:</b> ₦${stats.pendingBonuses}\n` +
        `✅ <b>Total Paid Bonuses:</b> ₦${stats.totalPaidBonuses}\n` +
        `💵 <b>Unpaid Balance:</b> ₦${stats.unpaidBalance}\n\n` +
        `📢 <b>How it works:</b>\n` +
        `Share your referral link with friends. When they make their first deposit, you earn ₦200!`;

      const keyboard = new InlineKeyboard()
        .url('📤 Share Link', `https://t.me/share/url?url=${encodeURIComponent(referralLink)}&text=Join%20GasBot%20and%20get%20instant%20crypto%20gas!`)
        .row()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply(message, {
        parse_mode: 'HTML',
        reply_markup: keyboard,
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /ref command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong fetching your referral stats. Please try again.');
    }
  }

  private async handleBankCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      });

      ctx.session.userId = user.id;
      await this.handleBank(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /bank command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleWalletCommand(ctx: BotContext) {
    try {
      if (!ctx.from) {
        await ctx.reply('Unable to identify user. Please try again.');
        return;
      }

      const telegramId = BigInt(ctx.from.id);
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username: ctx.from.username,
        firstName: ctx.from.first_name,
      });

      ctx.session.userId = user.id;
      await this.handleWallet(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /wallet command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleBank(ctx: BotContext) {
    try {
      if (!ctx.session.userId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      ctx.session.step = BotSessionStep.AWAITING_BANK_SELECTION;
      ctx.session.addBankFlow = true;

      // Fetch banks from wallet service
      const banks = await this.walletService.getBanks();

      // Build keyboard with bank options (limit to first 20 for Telegram)
      const keyboard = new InlineKeyboard();
      banks.slice(0, 20).forEach((bank, index) => {
        keyboard.text(bank.name, `BANK_CODE_${bank.code}`);
        if ((index + 1) % 2 === 0 || index === Math.min(banks.length, 20) - 1) {
          keyboard.row();
        }
      });
      keyboard.text('⬅️ Back', BotCallbackAction.ACTION_BACK);
      keyboard.text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = '🏦 <b>Add Bank Account</b>\n\nSelect your bank from the list below:';

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_BANK handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleBankCodeSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        }
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const bankCode = callbackData.replace('BANK_CODE_', '');

      // Get bank name from the code
      const banks = await this.walletService.getBanks();
      const selectedBank = banks.find(b => b.code === bankCode);

      if (!selectedBank) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid bank selection' });
        }
        return;
      }

      ctx.session.selectedBankCode = bankCode;
      ctx.session.step = BotSessionStep.AWAITING_ACCOUNT_NUMBER;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = `📝 <b>Enter Account Number</b>\n\nYou selected: ${selectedBank.name}\n\nPlease enter your 10-digit NUBAN account number:`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in bank code selection handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleWallet(ctx: BotContext) {
    try {
      if (!ctx.session.userId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      // Get wallet balance and saved banks
      const walletData = await this.walletService.getWalletBalance(ctx.session.userId);

      const formattedBalance = walletData.formattedBalance;
      const savedBanks = walletData.savedBanks;

      // Build message with wallet info
      let message = 
        `💰 <b>My Wallet</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💵 <b>Balance:</b> ₦${formattedBalance}\n\n`;

      if (savedBanks.length > 0) {
        message += `🏦 <b>Saved Banks:</b>\n`;
        savedBanks.forEach((bank, index) => {
          message += `${index + 1}. ${bank.bankName} - ${bank.accountNumber}\n`;
        });
        message += '\n';
      } else {
        message += `🏦 <b>Saved Banks:</b> None\n\n`;
      }

      message += `━━━━━━━━━━━━━━━━━━`;

      // Build keyboard
      const keyboard = new InlineKeyboard()
        .text('➕ Add Bank', BotCallbackAction.ACTION_BANK)
        .row();

      if (savedBanks.length > 0) {
        keyboard.text('💸 Withdraw', BotCallbackAction.ACTION_WITHDRAW);
        keyboard.row();
      }

      keyboard.text('🏠 Home', BotCallbackAction.ACTION_HOME);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_WALLET handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleWithdraw(ctx: BotContext) {
    try {
      if (!ctx.session.userId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      // Get user's saved banks
      const walletData = await this.walletService.getWalletBalance(ctx.session.userId);

      if (walletData.savedBanks.length === 0) {
        const keyboard = new InlineKeyboard()
          .text('➕ Add Bank', BotCallbackAction.ACTION_BANK)
          .row()
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);

        await ctx.reply(
          '❌ You have no saved bank accounts. Please add a bank account first.',
          { reply_markup: keyboard }
        );
        return;
      }

      ctx.session.step = BotSessionStep.AWAITING_WITHDRAWAL_AMOUNT;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = 
        `💸 <b>Withdraw Funds</b>\n\n` +
        `💵 <b>Available Balance:</b> ₦${walletData.formattedBalance}\n\n` +
        `Please enter the amount you want to withdraw (₦):`;

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_WITHDRAW handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleBack(ctx: BotContext) {
    try {
      const currentStep = ctx.session.step;
      const currentUserId = ctx.session.userId; // Preserve userId

      switch (currentStep) {
        case BotSessionStep.SELECT_CHAIN:
          // Go to IDLE (Main Menu)
          await this.sendMainMenu(ctx);
          break;
        
        case BotSessionStep.SELECT_AMOUNT:
          // Go back to Chain Selection
          ctx.session.step = BotSessionStep.SELECT_CHAIN;
          ctx.session.selectedAmountNaira = null;
          ctx.session.userId = currentUserId; // Preserve userId

          // Get enabled chains dynamically
          const enabledChains = await this.settingsService.getAllEnabledChains();
          
          // Build keyboard with only enabled chains
          const chainKeyboard = new InlineKeyboard();
          
          const chainMapping: Record<string, BotCallbackChain> = {
            'SOLANA': BotCallbackChain.CHAIN_SOLANA,
            'BASE': BotCallbackChain.CHAIN_BASE,
            'TON': BotCallbackChain.CHAIN_TON,
          };
          
          enabledChains.forEach((chain, index) => {
            const chainCallback = chainMapping[chain];
            if (chainCallback) {
              chainKeyboard.text(CHAIN_DISPLAY_NAMES[chainCallback], chainCallback);
              if ((index + 1) % 3 === 0 || index === enabledChains.length - 1) {
                chainKeyboard.row();
              }
            }
          });
          
          chainKeyboard.text('🏠 Home', BotCallbackAction.ACTION_HOME);
          
          const chainMessage = 'Select the blockchain network:';
          if (ctx.callbackQuery) {
            await ctx.editMessageText(chainMessage, { reply_markup: chainKeyboard });
            await ctx.answerCallbackQuery();
          } else {
            await ctx.reply(chainMessage, { reply_markup: chainKeyboard });
          }
          break;
        
        case BotSessionStep.AWAITING_CUSTOM_AMOUNT:
          // Go back to Amount Selection
          ctx.session.step = BotSessionStep.SELECT_AMOUNT;
          ctx.session.userId = currentUserId; // Preserve userId

          const customAmountKeyboard = new InlineKeyboard()
            .text('₦1,000', BotCallbackAmount.AMT_1000)
            .text('₦2,500', BotCallbackAmount.AMT_2500)
            .text('₦5,000', BotCallbackAmount.AMT_5000)
            .row()
            .text('✍️ Custom Amount', BotCallbackAmount.AMT_CUSTOM)
            .row()
            .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
            .text('🏠 Home', BotCallbackAction.ACTION_HOME);
          
          const customChainName = ctx.session.selectedChain;
          const customAmountMessage = `Select amount for ${customChainName}:`;
          
          if (ctx.callbackQuery) {
            await ctx.editMessageText(customAmountMessage, { reply_markup: customAmountKeyboard });
            await ctx.answerCallbackQuery();
          } else {
            await ctx.reply(customAmountMessage, { reply_markup: customAmountKeyboard });
          }
          break;
        
        case BotSessionStep.AWAITING_WALLET:
          // Go back to Amount Selection
          ctx.session.step = BotSessionStep.SELECT_AMOUNT;
          ctx.session.userId = currentUserId; // Preserve userId
          
          const amountKeyboard = new InlineKeyboard()
            .text('₦1,000', BotCallbackAmount.AMT_1000)
            .text('₦2,500', BotCallbackAmount.AMT_2500)
            .text('₦5,000', BotCallbackAmount.AMT_5000)
            .row()
            .text('✍️ Custom Amount', BotCallbackAmount.AMT_CUSTOM)
            .row()
            .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
            .text('🏠 Home', BotCallbackAction.ACTION_HOME);
          
          const chainName = ctx.session.selectedChain;
          const amountMessage = `Select amount for ${chainName}:`;
          
          if (ctx.callbackQuery) {
            await ctx.editMessageText(amountMessage, { reply_markup: amountKeyboard });
            await ctx.answerCallbackQuery();
          } else {
            await ctx.reply(amountMessage, { reply_markup: amountKeyboard });
          }
          break;
        
        default:
          await this.sendMainMenu(ctx);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_BACK handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handlePayNow(ctx: BotContext) {
    try {
      const orderId = ctx.session.lastOrderId;
      
      if (!orderId) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'No order found. Please start a new order.' });
        }
        await this.sendMainMenu(ctx);
        return;
      }

      // Get order details
      const order = await this.ordersService.findById(orderId);
      
      if (!order) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Order not found. Please start a new order.' });
        }
        await this.sendMainMenu(ctx);
        return;
      }

      // Initialize Paystack transaction
      const paymentResult = await this.paymentsService.initializePaystackTransaction(orderId);
      
      if (!paymentResult.authorizationUrl) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Failed to initialize payment. Please try again.' });
        }
        return;
      }

      const totalAmount = Number(order.totalAmount).toLocaleString();

      // Create inline keyboard with payment URL button
      const keyboard = new InlineKeyboard()
        .url(`💳 Pay ₦${totalAmount} Now`, paymentResult.authorizationUrl)
        .row()
        .text('❌ Cancel', BotCallbackAction.ACTION_CANCEL_ORDER);

      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: 'Payment page generated!' });
      }
      
      await ctx.reply(
        `💳 Payment Ready\n\n` +
        `Order ID: ${order.id.substring(0, 8)}...\n` +
        `Amount: ₦${totalAmount}\n` +
        `Status: ⏳ Awaiting Payment\n\n` +
        `Click the button below to complete your payment via Paystack:`,
        { reply_markup: keyboard }
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_PAY_NOW handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing payment request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing payment request. Please try again.');
      }
    }
  }

  private async handleCancelOrder(ctx: BotContext) {
    try {
      // Clear the last order ID from session
      ctx.session.lastOrderId = null;
      
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: 'Order cancelled' });
      }
      await this.sendMainMenu(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_CANCEL_ORDER handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error cancelling order' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      }
    }
  }

  private async sendMainMenu(ctx: BotContext, firstName?: string) {
    const keyboard = new InlineKeyboard()
      .text('⛽ Buy Crypto', BotCallbackAction.ACTION_BUY_GAS)
      .row()
      .text('💰 Sell Crypto (Bybit UID)', BotCallbackAction.ACTION_SELL_CRYPTO)
      .row()
      .text('💵 My Wallet', BotCallbackAction.ACTION_WALLET)
      .text('📜 My Orders', BotCallbackAction.ACTION_MY_ORDERS)
      .row()
      .text('❓ Help', BotCallbackAction.ACTION_HELP);

    const message = firstName 
      ? `Welcome ${firstName}! 🚀\n\nI'm your Micro-Gas transaction bot. Use the buttons below to get started.`
      : `🏠 Main Menu\n\nWelcome back! Choose an option below:`;

    if (ctx.callbackQuery) {
      await ctx.editMessageText(message, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } else {
      await ctx.reply(message, { reply_markup: keyboard });
    }
  }

  private async handleHome(ctx: BotContext) {
    try {
      // Reset session state but keep userId
      const currentUserId = ctx.session.userId;
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.selectedChain = null;
      ctx.session.selectedAmountNaira = null;
      ctx.session.userId = currentUserId;

      // Render main menu screen
      await this.sendMainMenu(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_HOME handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleSellCrypto(ctx: BotContext) {
    try {
      // Ensure userId is set
      if (!ctx.session.userId && ctx.from) {
        const telegramId = BigInt(ctx.from.id);
        const user = await this.usersService.findOrCreateUser({
          telegramId,
          username: ctx.from.username,
          firstName: ctx.from.first_name,
        });
        ctx.session.userId = user.id;
      }

      ctx.session.step = BotSessionStep.AWAITING_SELL_AMOUNT;
      ctx.session.selectedChain = null;
      ctx.session.selectedAmountNaira = null;

      const corporateBybitUid = process.env.CORPORATE_BYBIT_UID || '118368783';

      const message = 
        `💰 <b>Sell USDT (Bybit UID)</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `📋 <b>Instructions:</b>\n` +
        `1. Send USDT to our corporate Bybit UID: <code>${corporateBybitUid}</code>\n` +
        `2. Take a screenshot of the transaction\n` +
        `3. Enter the amount you sent\n` +
        `4. Provide your Bybit Transaction ID\n` +
        `5. Choose payout destination\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⚠️ <b>Important:</b>\n` +
        `• Only USDT is supported\n` +
        `• Minimum: 10 USDT\n` +
        `• Rate based on admin settings\n` +
        `• Payout after admin verification\n\n` +
        `Please enter the amount of USDT you sent:`;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { 
          parse_mode: 'HTML',
          reply_markup: keyboard 
        });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_SELL_CRYPTO handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleCryptoAssetSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        }
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      
      // USDT-only off-ramp - no asset selection needed
      // This handler is kept for backward compatibility but shouldn't be called
      if (ctx.callbackQuery) {
        await ctx.answerCallbackQuery({ text: 'USDT-only off-ramp enabled' });
      }
      return;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in crypto asset selection handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async handleBankSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        }
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const bankId = callbackData.replace('BANK_SELECT_', '');

      if (!ctx.session.userId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      // Verify the bank belongs to the user
      const savedBank = await this.prisma.savedBank.findUnique({
        where: { id: bankId },
      });

      if (!savedBank || savedBank.userId !== ctx.session.userId) {
        await ctx.reply('Invalid bank selection. Please try again.');
        return;
      }

      // Check if this is for withdrawal or off-ramp
      if (ctx.session.step === BotSessionStep.AWAITING_WITHDRAWAL_BANK) {
        // Process withdrawal
        await this.processWithdrawal(ctx, bankId);
      } else {
        // Submit the off-ramp request with the selected bank
        await this.submitOfframpRequest(ctx, 'SAVED_BANK', bankId);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in bank selection handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async processWithdrawal(ctx: BotContext, bankId: string) {
    try {
      if (!ctx.session.userId || !ctx.session.withdrawalAmount) {
        await ctx.reply('Session expired. Please start over with /wallet');
        return;
      }

      const amount = ctx.session.withdrawalAmount;

      // Process withdrawal via wallet service
      const result = await this.walletService.withdraw(
        ctx.session.userId,
        amount,
        bankId
      );

      // Reset session
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.withdrawalAmount = null;
      ctx.session.withdrawalBankId = null;

      const message = 
        `✅ <b>Withdrawal Processed Successfully</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💸 <b>Amount:</b> ₦${amount.toLocaleString()}\n` +
        `📝 <b>Reference:</b> ${result.reference}\n` +
        `🆔 <b>Transaction ID:</b> ${result.transactionId}\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `Your withdrawal has been initiated and will be processed within 24-48 hours.`;

      const keyboard = new InlineKeyboard()
        .text('💰 My Wallet', BotCallbackAction.ACTION_WALLET)
        .row()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply(message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard 
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error processing withdrawal: ${err.message}`, err.stack);
      
      const keyboard = new InlineKeyboard()
        .text('💰 My Wallet', BotCallbackAction.ACTION_WALLET)
        .row()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);
      
      await ctx.reply(`❌ Withdrawal failed: ${err.message}. Please try again.`, { reply_markup: keyboard });
    }
  }

  private async handlePayoutDestination(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        }
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      this.logger.log(`Payout destination callback received: ${callbackData}`);
      
      // Map callback to payout destination
      const destinationMap: Record<string, 'INTERNAL_WALLET' | 'SAVED_BANK'> = {
        [BotCallbackPayoutDestination.PAYOUT_INTERNAL_WALLET]: 'INTERNAL_WALLET',
        [BotCallbackPayoutDestination.PAYOUT_SAVED_BANK]: 'SAVED_BANK',
      };

      const selectedDestination = destinationMap[callbackData];
      this.logger.log(`Selected destination: ${selectedDestination}`);
      
      if (!selectedDestination) {
        if (ctx.callbackQuery) {
          await ctx.answerCallbackQuery({ text: 'Invalid payout destination selection' });
        }
        return;
      }

      if (selectedDestination === 'INTERNAL_WALLET') {
        this.logger.log('Submitting off-ramp request with INTERNAL_WALLET');
        // Submit the off-ramp request with internal wallet
        await this.submitOfframpRequest(ctx, 'INTERNAL_WALLET');
      } else {
        this.logger.log('Showing saved banks selection');
        // Show saved banks for selection
        await this.showSavedBanks(ctx);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in payout destination handler: ${err.message}`, err.stack);
      
      if (ctx.callbackQuery) {
        try {
          await ctx.answerCallbackQuery({ text: 'Error processing request' });
        } catch (answerError) {
          // Ignore answer callback errors
        }
      } else {
        await ctx.reply('Error processing request. Please try again.');
      }
    }
  }

  private async showSavedBanks(ctx: BotContext) {
    try {
      if (!ctx.session.userId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      // Get user's saved banks
      const user = await this.prisma.user.findUnique({
        where: { id: ctx.session.userId },
        include: {
          savedBanks: true,
        },
      });

      if (!user || user.savedBanks.length === 0) {
        const keyboard = new InlineKeyboard()
          .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
          .text('🏠 Home', BotCallbackAction.ACTION_HOME);

        await ctx.reply(
          '❌ You have no saved bank accounts. Please add a bank account on the web dashboard first.',
          { reply_markup: keyboard }
        );
        return;
      }

      ctx.session.step = BotSessionStep.AWAITING_SELL_BANK_CHOICE;

      // Build keyboard with saved banks
      const keyboard = new InlineKeyboard();
      user.savedBanks.forEach((bank, index) => {
        keyboard.text(`${bank.bankName} - ${bank.accountNumber}`, `BANK_SELECT_${bank.id}`);
        if ((index + 1) % 2 === 0 || index === user.savedBanks.length - 1) {
          keyboard.row();
        }
      });
      keyboard.text('⬅️ Back', BotCallbackAction.ACTION_BACK);
      keyboard.text('🏠 Home', BotCallbackAction.ACTION_HOME);

      const message = 'Select your saved bank account for payout:';

      if (ctx.callbackQuery) {
        await ctx.editMessageText(message, { reply_markup: keyboard });
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(message, { reply_markup: keyboard });
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error showing saved banks: ${err.message}`, err.stack);
      await ctx.reply('Error processing request. Please try again.');
    }
  }

  private async submitOfframpRequest(ctx: BotContext, payoutDestination: 'INTERNAL_WALLET' | 'SAVED_BANK', savedBankId?: string) {
    try {
      if (!ctx.session.userId) {
        await ctx.reply('Unable to identify user. Please start over with /start');
        return;
      }

      const cryptoAsset = ctx.session.sellCryptoAsset; // Using the dedicated sell crypto asset field
      const cryptoAmount = ctx.session.sellCryptoAmount; // Using the dedicated sell crypto amount field
      const userBybitTxId = ctx.session.sellTxId; // Using the dedicated sell Tx ID field

      this.logger.log(`Session data check - userId: ${ctx.session.userId}, cryptoAsset: ${cryptoAsset}, cryptoAmount: ${cryptoAmount}, txId: ${userBybitTxId}`);

      if (!cryptoAsset || !cryptoAmount || !userBybitTxId) {
        this.logger.error(`Missing session data - cryptoAsset: ${cryptoAsset}, cryptoAmount: ${cryptoAmount}, txId: ${userBybitTxId}`);
        await ctx.reply('Missing information. Please start over with /start');
        return;
      }

      // Call the offramp service via HTTP
      const apiBaseUrl = this.configService.get<string>('API_BASE_URL') || 'http://localhost:5000';
      const response = await firstValueFrom(
        this.httpService.post(
          `${apiBaseUrl}/api/v1/offramp/bot-submit`,
          {
            userId: ctx.session.userId,
            cryptoAsset,
            cryptoAmount,
            userBybitTxId,
            payoutDestination,
            savedBankId,
          }
        )
      );

      const offrampRequest = response.data;

      // Reset session
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.sellCryptoAsset = null;
      ctx.session.sellCryptoAmount = null;
      ctx.session.sellTxId = null;

      const message = 
        `✅ <b>Off-Ramp Request Submitted</b>\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `💰 <b>Amount:</b> ${cryptoAmount} ${cryptoAsset}\n` +
        `💵 <b>NGN Value:</b> ₦${offrampRequest.ngnValue.toLocaleString()}\n` +
        `📈 <b>Rate:</b> ₦${offrampRequest.exchangeRate.toLocaleString()}\n` +
        `🏦 <b>Payout:</b> ${payoutDestination}\n` +
        `📝 <b>Status:</b> Pending Verification\n\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `⏳ Your request will be reviewed by our admin team.\n` +
        `💵 You'll receive NGN payout after verification.\n\n` +
        `📜 Request ID: <code>${offrampRequest.id.substring(0, 8)}...</code>`;

      const keyboard = new InlineKeyboard()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.reply(message, { 
        parse_mode: 'HTML',
        reply_markup: keyboard 
      });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error submitting off-ramp request: ${err.message}`, err.stack);
      await ctx.reply('Error processing request. Please try again.');
    }
  }

  async onModuleInit() {
    try {
      const isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';
      const enableBot = this.configService.get<string>('ENABLE_BOT') !== 'false';
      
      if (!enableBot) {
        this.logger.log('Bot is disabled via ENABLE_BOT=false. Payment endpoints remain available.');
        return;
      }
      
      // Register bot commands with Telegram (with error handling)
      try {
        await this.bot.api.setMyCommands([
          { command: 'start', description: 'Main Menu & Home' },
          { command: 'buygas', description: '⛽ Buy Crypto' },
          { command: 'orders', description: '📜 View My Orders' },
          { command: 'help', description: '❓ Support & Guide' },
          { command: 'home', description: '🏠 Return to Main Menu' },
          { command: 'link', description: '🔗 Link Web Account' },
          { command: 'bank', description: '🏦 Add Bank Account' },
          { command: 'wallet', description: '💰 View Wallet' },
        ]);
        this.logger.log('Bot commands registered successfully');
      } catch (telegramError) {
        const err = telegramError as Error;
        this.logger.warn(`Failed to register bot commands (Telegram API may be unreachable): ${err.message}`);
        this.logger.log('Continuing without bot commands registration...');
      }
      
      if (isDevelopment) {
        this.logger.log('Starting bot in development mode (long-polling)...');
        // Start bot asynchronously without blocking module initialization
        this.bot.start().then(() => {
          this.logger.log('Bot started successfully and is listening for messages');
        }).catch((startError) => {
          const err = startError as Error;
          this.logger.warn(`Failed to start bot (network issues?): ${err.message}`);
          this.logger.log('Application will continue without bot - payment endpoints remain available');
        });
      } else {
        this.logger.log('Bot webhook setup required for production mode');
        // Webhook setup would be implemented here for production
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to initialize bot service: ${err.message}`, err.stack);
      this.logger.log('Application will continue without bot - payment endpoints remain available');
    }
  }

  /**
   * Send notification to a specific user by Telegram ID
   * Used for order status updates, gas dispense notifications, etc.
   */
  async sendNotification(telegramId: bigint, message: string, options?: any) {
    try {
      await this.bot.api.sendMessage(telegramId.toString(), message, {
        parse_mode: 'HTML',
        ...options,
      });
      this.logger.log(`Notification sent to Telegram ID: ${telegramId}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to send notification to ${telegramId}: ${err.message}`);
      // Don't throw - notification failures shouldn't break the main flow
    }
  }

  async onModuleDestroy() {
    try {
      this.logger.log('Stopping bot...');
      await this.bot.stop();
      this.logger.log('Bot stopped successfully');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error stopping bot: ${err.message}`, err.stack);
    }
  }
}