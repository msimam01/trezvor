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
    private readonly settingsService: SettingsService,
    private readonly paymentsService: PaymentsService,
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
            DISPENSED_SUCCESS: '🎉',
            FAILED_REFUND_NEEDED: '❌',
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
        .text('✍️ Custom Amount', BotCallbackAmount.AMT_CUSTOM)
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

      // Validate against minimum amount for selected chain
      const chain = ctx.session.selectedChain;
      if (chain) {
        const chainConfig = await this.settingsService.getChainConfig(chain as any);
        if (amount < chainConfig.minAmountNaira) {
          await ctx.answerCallbackQuery({ 
            text: `Minimum order for ${chain} is ₦${chainConfig.minAmountNaira}` 
          });
          return;
        }
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

  private async handleCustomAmount(ctx: BotContext) {
    try {
      const chain = ctx.session.selectedChain;
      if (!chain) {
        await ctx.answerCallbackQuery({ text: 'Please select a chain first' });
        return;
      }

      // Get chain config for minimum amount
      const chainConfig = await this.settingsService.getChainConfig(chain as any);
      
      ctx.session.step = BotSessionStep.AWAITING_CUSTOM_AMOUNT;

      const keyboard = new InlineKeyboard()
        .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
        .text('🏠 Home', BotCallbackAction.ACTION_HOME);

      await ctx.editMessageText(
        `Enter custom Naira amount (Minimum for ${chain} is ₦${chainConfig.minAmountNaira}):`,
        { reply_markup: keyboard }
      );
      await ctx.answerCallbackQuery();
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in custom amount handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
    }
  }

  private async handleTextMessage(ctx: BotContext) {
    try {
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

      // Calculate fees using dynamic rate
      const fiatAmount = ctx.session.selectedAmountNaira;
      if (!fiatAmount) {
        await ctx.reply('Invalid amount. Please start over with /start');
        return;
      }

      const platformFeePercent = await this.settingsService.getGlobalFeePercent();
      const feeNaira = fiatAmount * (platformFeePercent / 100);
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

      // Send order summary with dynamic fee percentage
      const summary =
        `✅ Order Created Successfully!\n\n` +
        `📋 Order Details:\n` +
        `━━━━━━━━━━━━━━━━━━\n` +
        `🔗 Chain: ${chain}\n` +
        `💰 Gas Amount: ₦${fiatAmount.toLocaleString()}\n` +
        `💳 Platform Fee: ₦${feeNaira.toLocaleString()} (${platformFeePercent}%)\n` +
        `💵 Total: ₦${totalAmount.toLocaleString()}\n` +
        `👛 Wallet: ${walletAddress.substring(0, 8)}...${walletAddress.substring(walletAddress.length - 4)}\n` +
        `📝 Order ID: ${order.id.substring(0, 8)}...\n\n` +
        `Status: ⏳ Pending Payment`;

      const keyboard = new InlineKeyboard()
        .text('💳 Pay Now', BotCallbackAction.ACTION_PAY_NOW)
        .row()
        .text('❌ Cancel', BotCallbackAction.ACTION_CANCEL_ORDER);

      await ctx.reply(summary, { reply_markup: keyboard });
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in text message handler: ${err.message}`, err.stack);
      await ctx.reply('Sorry, something went wrong. Please try again starting with /start');
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
          
          await ctx.editMessageText('Select the blockchain network:', { reply_markup: chainKeyboard });
          await ctx.answerCallbackQuery();
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
          await ctx.editMessageText(`Select amount for ${customChainName}:`, { reply_markup: customAmountKeyboard });
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
            .text('✍️ Custom Amount', BotCallbackAmount.AMT_CUSTOM)
            .row()
            .text('⬅️ Back', BotCallbackAction.ACTION_BACK)
            .text('🏠 Home', BotCallbackAction.ACTION_HOME);
          
          const chainName = ctx.session.selectedChain;
          await ctx.editMessageText(`Select amount for ${chainName}:`, { reply_markup: amountKeyboard });
          await ctx.answerCallbackQuery();
          break;
        
        default:
          await this.sendMainMenu(ctx);
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
        await this.sendMainMenu(ctx);
        return;
      }

      // Get order details
      const order = await this.ordersService.findById(orderId);
      
      if (!order) {
        await ctx.answerCallbackQuery({ text: 'Order not found. Please start a new order.' });
        await this.sendMainMenu(ctx);
        return;
      }

      // Initialize Paystack transaction
      const paymentResult = await this.paymentsService.initializePaystackTransaction(orderId);
      
      if (!paymentResult.authorizationUrl) {
        await ctx.answerCallbackQuery({ text: 'Failed to initialize payment. Please try again.' });
        return;
      }

      const totalAmount = Number(order.totalAmount).toLocaleString();

      // Create inline keyboard with payment URL button
      const keyboard = new InlineKeyboard()
        .url(`💳 Pay ₦${totalAmount} Now`, paymentResult.authorizationUrl)
        .row()
        .text('❌ Cancel', BotCallbackAction.ACTION_CANCEL_ORDER);

      await ctx.answerCallbackQuery({ text: 'Payment page generated!' });
      
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
      await ctx.answerCallbackQuery({ text: 'Error processing payment request' });
    }
  }

  private async handleCancelOrder(ctx: BotContext) {
    try {
      // Clear the last order ID from session
      ctx.session.lastOrderId = null;
      
      await ctx.answerCallbackQuery({ text: 'Order cancelled' });
      await this.sendMainMenu(ctx);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error in ACTION_CANCEL_ORDER handler: ${err.message}`, err.stack);
      await ctx.answerCallbackQuery({ text: 'Error cancelling order' });
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
      await ctx.answerCallbackQuery({ text: 'Error processing request' });
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
          this.logger.log('Bot started successfully');
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