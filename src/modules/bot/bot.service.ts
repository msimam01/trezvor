import { Injectable, OnModuleInit, OnModuleDestroy, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Bot, session, InlineKeyboard, Context, SessionFlavor } from 'grammy';
import { 
  BotCallbackAction, 
  BotCallbackChain, 
  BotCallbackAmount, 
  BotSessionStep,
  AMOUNT_NAIRA_MAP,
  CHAIN_DISPLAY_NAMES,
  PLATFORM_FEE_PERCENTAGE
} from './bot.constants';
import { UsersService } from '../users/users.service';
import { OrdersService } from '../orders/orders.service';
import { validateWalletAddress, getValidationErrorMessage, ChainType } from './helpers/wallet-validator';

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

    // Register callback query handlers
    this.bot.callbackQuery(BotCallbackAction.ACTION_BUY_GAS, this.handleBuyGas.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_MY_ORDERS, this.handleMyOrders.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_HELP, this.handleHelp.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_BACK, this.handleBack.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_HOME, this.handleHome.bind(this));
    this.bot.callbackQuery(BotCallbackAction.ACTION_PAY_NOW, this.handlePayNow.bind(this));

    // Chain selection handlers
    this.bot.callbackQuery(BotCallbackChain.CHAIN_SOLANA, this.handleChainSelection.bind(this));
    this.bot.callbackQuery(BotCallbackChain.CHAIN_BASE, this.handleChainSelection.bind(this));
    this.bot.callbackQuery(BotCallbackChain.CHAIN_TON, this.handleChainSelection.bind(this));

    // Amount selection handlers
    this.bot.callbackQuery(BotCallbackAmount.AMT_1000, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_2500, this.handleAmountSelection.bind(this));
    this.bot.callbackQuery(BotCallbackAmount.AMT_5000, this.handleAmountSelection.bind(this));

    // Message handler for wallet address
    this.bot.on('message:text', this.handleTextMessage.bind(this));

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

      // Send welcome message with inline keyboard
      const keyboard = new InlineKeyboard()
        .text('⛽ Buy Micro-Gas', BotCallbackAction.ACTION_BUY_GAS)
        .row()
        .text('📜 My Orders', BotCallbackAction.ACTION_MY_ORDERS)
        .text('❓ Help', BotCallbackAction.ACTION_HELP);

      await ctx.reply(
        `Welcome ${firstName || 'User'}! 🚀\n\n` +
        `I'm your Micro-Gas transaction bot. Use the buttons below to get started.`,
        { reply_markup: keyboard },
      );
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

      const keyboard = new InlineKeyboard()
        .text(CHAIN_DISPLAY_NAMES[BotCallbackChain.CHAIN_SOLANA], BotCallbackChain.CHAIN_SOLANA)
        .text(CHAIN_DISPLAY_NAMES[BotCallbackChain.CHAIN_BASE], BotCallbackChain.CHAIN_BASE)
        .text(CHAIN_DISPLAY_NAMES[BotCallbackChain.CHAIN_TON], BotCallbackChain.CHAIN_TON)
        .row()
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.editMessageText('Select the blockchain network:', { reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_BUY_GAS handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handleMyOrders(ctx: BotContext) {
    try {
      await ctx.editMessageText('📜 My Orders feature coming soon!');
      await ctx.answerCallbackQuery();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_MY_ORDERS handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handleHelp(ctx: BotContext) {
    try {
      const helpText = 
        '❓ Help\n\n' +
        'How to use this bot:\n' +
        '1. Click "Buy Micro-Gas" to start a transaction\n' +
        '2. Select your preferred blockchain (Solana, Base, or TON)\n' +
        '3. Choose the amount you want to purchase\n' +
        '4. Provide your wallet address\n' +
        '5. Complete payment via the payment gateway\n' +
        '6. Receive your gas tokens automatically\n\n' +
        'Need support? Contact @support';
      
      await ctx.editMessageText(helpText);
      await ctx.answerCallbackQuery();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_HELP handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handleChainSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
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
        await ctx.answerCallbackQuery({ text: 'Invalid chain selection' });
        return;
      }

      ctx.session.selectedChain = selectedChain;
      ctx.session.step = BotSessionStep.SELECT_AMOUNT;

      const keyboard = new InlineKeyboard()
        .text('₦1,000', BotCallbackAmount.AMT_1000)
        .text('₦2,500', BotCallbackAmount.AMT_2500)
        .text('₦5,000', BotCallbackAmount.AMT_5000)
        .row()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.editMessageText(`Select amount for ${CHAIN_DISPLAY_NAMES[callbackData as BotCallbackChain]}:`, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in chain selection handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handleAmountSelection(ctx: BotContext) {
    try {
      if (!ctx.callbackQuery?.data) {
        await ctx.answerCallbackQuery({ text: 'Invalid callback data' });
        return;
      }

      const callbackData = ctx.callbackQuery.data;
      const amount = AMOUNT_NAIRA_MAP[callbackData as BotCallbackAmount];

      if (!amount) {
        await ctx.answerCallbackQuery({ text: 'Invalid amount selection' });
        return;
      }

      ctx.session.selectedAmountNaira = amount;
      ctx.session.step = BotSessionStep.AWAITING_WALLET;

      const chainName = ctx.session.selectedChain;
      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.editMessageText(`Please reply with your target wallet address for ${chainName}:`, { reply_markup: keyboard });
      await ctx.answerCallbackQuery();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in amount selection handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handleTextMessage(ctx: BotContext) {
    try {
      // Only process if we're awaiting wallet address
      if (ctx.session.step !== BotSessionStep.AWAITING_WALLET) {
        return;
      }

      if (!ctx.message?.text) {
        await ctx.reply('Please provide a valid wallet address.');
        return;
      }

      const walletAddress = ctx.message.text.trim();
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

      // Calculate fees
      const fiatAmount = ctx.session.selectedAmountNaira;
      if (!fiatAmount) {
        await ctx.reply('Invalid amount. Please start over with /start');
        return;
      }

      const feeNaira = fiatAmount * PLATFORM_FEE_PERCENTAGE;
      const totalAmount = fiatAmount + feeNaira;

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

      const order = await this.ordersService.createOrder({
        userId: currentUserId,
        chain: chain as any,
        targetWallet: walletAddress,
        fiatAmountNaira: fiatAmount,
        feeNaira,
        totalAmount,
        cryptoAmount: 0, // Will be calculated based on current rates
        paymentGateway: 'PAYSTACK' as any, // Default gateway
        status: 'PENDING_PAYMENT' as any,
      });

      // Store order ID in session for payment processing
      ctx.session.lastOrderId = order.id;

      // Send order summary
      const summary =
        `✅ Order Created Successfully!\n\n` +
        `📋 Order Details:\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔗 Chain: ${chain}\n` +
        `💰 Gas Amount: ₦${fiatAmount.toLocaleString()}\n` +
        `💳 Platform Fee: ₦${feeNaira.toLocaleString()} (15%)\n` +
        `💵 Total: ₦${totalAmount.toLocaleString()}\n` +
        `👛 Wallet: ${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 4)}\n` +
        `📝 Order ID: ${order.id.substring(0, 8)}...\n\n` +
        `Status: ⏳ Pending Payment`;

      const keyboard = new InlineKeyboard()
        .text('💳 Pay Now', BotCallbackAction.ACTION_PAY_NOW)
        .row()
        .text('❌ Cancel', BotCallbackAction.ACTION_HOME);

      await ctx.reply(summary, { reply_markup: keyboard });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in text message handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again starting with /start');
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
      await this.handleHome(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in /home command: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again.');
    }
  }

  private async handleBack(ctx: BotContext) {
    try {
      const currentStep = ctx.session.step;
      const currentUserId = ctx.session.userId; // Preserve userId

      switch (currentStep) {
        case BotSessionStep.SELECT_CHAIN:
          // Go to IDLE (Main Menu)
          await this.handleHome(ctx);
          break;
        
        case BotSessionStep.SELECT_AMOUNT:
          // Go back to Chain Selection
          ctx.session.step = BotSessionStep.SELECT_CHAIN;
          ctx.session.selectedAmountNaira = null;
          ctx.session.userId = currentUserId; // Preserve userId
          
          const chainKeyboard = new InlineKeyboard()
            .text(CHAIN_DISPLAY_NAMES[BotCallbackChain.CHAIN_SOLANA], BotCallbackChain.CHAIN_SOLANA)
            .text(CHAIN_DISPLAY_NAMES[BotCallbackChain.CHAIN_BASE], BotCallbackChain.CHAIN_BASE)
            .text(CHAIN_DISPLAY_NAMES[BotCallbackChain.CHAIN_TON], BotCallbackChain.CHAIN_TON)
            .row()
            .text('🏠 Home', BotCallbackAction.ACTION_HOME);
          
          await ctx.editMessageText('Select the blockchain network:', { reply_markup: chainKeyboard });
          await ctx.answerCallbackQuery();
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
            .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
            .text('🏠 Home', BotCallbackAction.ACTION_HOME);
          
          const chainName = ctx.session.selectedChain;
          await ctx.editMessageText(`Select amount for ${chainName}:`, { reply_markup: amountKeyboard });
          await ctx.answerCallbackQuery();
          break;
        
        default:
          await this.handleHome(ctx);
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_BACK handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handlePayNow(ctx: BotContext) {
    try {
      const orderId = ctx.session.lastOrderId;
      
      if (!orderId) {
        await ctx.answerCallbackQuery({ text: 'No order found. Please start a new order.' });
        await this.handleHome(ctx);
        return;
      }

      // Get order details
      const order = await this.ordersService.findById(orderId);
      
      if (!order) {
        await ctx.answerCallbackQuery({ text: 'Order not found. Please start a new order.' });
        await this.handleHome(ctx);
        return;
      }

      // Placeholder for payment integration (Module 4)
      await ctx.answerCallbackQuery({ 
        text: '💳 Payment integration coming soon in Module 4!' 
      });
      
      // For now, just show a message about the payment
      await ctx.reply(
        `💳 Payment Processing\n\n` +
        `Order ID: ${order.id.substring(0, 8)}...\n` +
        `Amount: ₦${order.totalAmount}\n` +
        `Status: ${order.status}\n\n` +
        `Payment gateway integration will be implemented in Module 4.\n\n` +
        `Use /home to return to main menu.`
      );
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_PAY_NOW handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing payment request' });
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
      const keyboard = new InlineKeyboard()
        .text('⛽ Buy Micro-Gas', BotCallbackAction.ACTION_BUY_GAS)
        .row()
        .text('📜 My Orders', BotCallbackAction.ACTION_MY_ORDERS)
        .text('❓ Help', BotCallbackAction.ACTION_HELP);

      if (ctx.callbackQuery) {
        await ctx.editMessageText(
          `🏠 Main Menu\n\n` +
          `Welcome back! Choose an option below:`,
          { reply_markup: keyboard },
        );
        await ctx.answerCallbackQuery();
      } else {
        await ctx.reply(
          `🏠 Main Menu\n\n` +
          `Welcome back! Choose an option below:`,
          { reply_markup: keyboard },
        );
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_HOME handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  async onModuleInit() {
    try {
      const isDevelopment = this.configService.get<string>('NODE_ENV') !== 'production';
      
      // Register bot commands with Telegram
      await this.bot.api.setMyCommands([
        { command: 'start', description: 'Main Menu & Home' },
        { command: 'buygas', description: '⛽ Buy Micro-Gas' },
        { command: 'orders', description: '📜 View My Orders' },
        { command: 'help', description: '❓ Support & Guide' },
        { command: 'home', description: '🏠 Return to Main Menu' },
      ]);
      this.logger.log('Bot commands registered successfully');
      
      if (isDevelopment) {
        this.logger.log('Starting bot in development mode (long-polling)...');
        await this.bot.start();
        this.logger.log('Bot started successfully');
      } else {
        this.logger.log('Bot webhook setup required for production mode');
        // Webhook setup would be implemented here for production
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to start bot: ${err.message}`, err.stack);
      throw error;
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