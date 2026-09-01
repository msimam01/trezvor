import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, session, InlineKeyboard, Context, SessionFlavor } from 'grammy';
import {
  BotCallbackAction,
  BotCallbackChain,
  BotCallbackAmount,
  BotSessionStep,
  AMOUNT_NAIRA_MAP,
  CHAIN_DISPLAY_NAMES
} from './bot.constants';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { SettingsService } from '../settings/settings.service';
import { PaymentsService } from '../payments/payments.service';
import { OracleService } from '../oracle/oracle.service';
import { validateWalletAddress, getValidationErrorMessage, ChainType } from './helpers/wallet-validator';
import { getExplorerUrl } from '../web3/helpers/explorer.helper';
import { PrismaService } from '../../prisma/prisma.service';

interface BotSessionData {
  step: BotSessionStep;
  selectedChain: 'SOLANA' | 'BASE' | 'TON' | null;
  selectedAmountNaira: number | null;
  userId: string | null; // Store the User UUID for order creation
  lastOrderId: string | null; // Store the last created order ID for payment
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
      }),
    }));

    // Register command handlers
    this.bot.command('start', this.handleStart.bind(this));
    this.bot.command('buygas', this.handleBuyGasCommand.bind(this));
    this.bot.command('orders', this.handleMyOrdersCommand.bind(this));
    this.bot.command('help', this.handleHelpCommand.bind(this));
    this.bot.command('home', this.handleHomeCommand.bind(this));
    this.bot.command('link', this.handleLinkCommand.bind(this));
    this.bot.command('ping', this.handlePingCommand.bind(this));

    // Register callback query handlers
    this.bot.callbackQuery(BotCallbackAction.ACTION_BUY_GAS, this.handleBuyGas.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_MY_ORDERS, this.handleMyOrders.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_HELP, this.handleHelp.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_BACK, this.handleBack.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_HOME, this.handleHome.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_PAY_NOW, this.handlePayNow.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_CANCEL_ORDER, this.handleCancelOrder.bind(this));

    // Chain selection handlers
    this.bot.callbackQuery(BotCallbackChain.CHAIN_SOLANA, this.handleChainSelection.bind(this));
    this.bot.callbackQuery(BotCallbackChain.CHAIN_BASE, this.handleChainSelection.bind(this));
    this.bot.callbackQuery(BotCallbackChain.CHAIN_TON, this.handleChainSelection.bind(this));

    // Amount selection handlers
    this.bot.callbackQuery(BotCallbackAmount.AMT_1000, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_2500, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_5000, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_CUSTOM, this.handleCustomAmount.bind(this));

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

      // Find or create user
      const user = await this.usersService.findOrCreateUser({
        telegramId,
        username,
        firstName,
      });

      // Reset session and store userId
      ctx.session.step = BotSessionStep.IDLE;
      ctx.session.selectedChain = null;
      ctx.session.selectedAmountNaira = null;
      ctx.session.userId = user.id;

      // Deep Link Handling: e.g., /start order_UUID
      const payload = ctx.match; // Captures deep-link parameter after ?start=
      
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
              ? '🚀 Your micro-gas is currently being queued for on-chain transfer!' 
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
        '1. Click "Buy Micro-Gas" to start a transaction\n' +
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
      .text('⛽ Buy Micro-Gas', BotCallbackAction.ACTION_BUY_GAS)
      .row()
      .text('📜 My Orders', BotCallbackAction.ACTION_MY_ORDERS)
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
          { command: 'buygas', description: '⛽ Buy Micro-Gas' },
          { command: 'orders', description: '📜 View My Orders' },
          { command: 'help', description: '❓ Support & Guide' },
          { command: 'home', description: '🏠 Return to Main Menu' },
          { command: 'link', description: '🔗 Link Web Account' },
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