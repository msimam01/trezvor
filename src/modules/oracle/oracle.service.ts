import { Injectable, Logger, Inject } from '@nestjs/common';
import { HttpService } from '@nestjs/axios';
import { ConfigService } from '@nestjs/config';
import { SupportedChain } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import Redis from 'ioredis';

@Injectable()
export class OracleService {
  private readonly logger = new Logger(OracleService.name);
  private readonly redis: Redis;

  private readonly COINGECKO_IDS = {
    SOLANA: 'solana',
    BASE: 'ethereum',
    TON: 'the-open-network',
    BSC: 'binancecoin',
  };

  private readonly BINANCE_SYMBOLS = {
    SOLANA: 'SOLUSDT',
    BASE: 'ETHUSDT',
    TON: 'TONUSDT',
    BSC: 'BNBUSDT',
  };

  // Emergency fallback rates (conservative estimates)
  private readonly EMERGENCY_RATES = {
    SOLANA: 240000, // 1 SOL = ₦240,000
    BASE: 4500000,  // 1 ETH = ₦4,500,000
    TON: 9000,      // 1 TON = ₦9,000
    BSC: 700000,    // 1 BNB = ₦700,000
  };

  // USDT/NGN fallback rate
  private readonly USDT_NGN_FALLBACK = 1600;

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // Initialize Redis connection
    this.redis = new Redis({
      host: this.configService.get<string>('REDIS_HOST', '127.0.0.1'),
      port: this.configService.get<number>('REDIS_PORT', 6379),
    });

    this.redis.on('error', (err) => {
      this.logger.error(`Redis connection error: ${err.message}`);
    });
  }

  /**
   * Get current price of cryptocurrency in NGN
   * Implements multi-layer fallback strategy: Redis -> CoinGecko -> Binance -> Emergency
   */
  async getPriceInNgn(chain: SupportedChain): Promise<number> {
    const cacheKey = `oracle:price:${chain}`;

    try {
      // 1. Redis Cache Check
      const cachedPrice = await this.redis.get(cacheKey);
      if (cachedPrice) {
        this.logger.log(`Using cached price for ${chain}: ₦${cachedPrice}`);
        return parseFloat(cachedPrice);
      }

      // 2. Primary Provider: CoinGecko API
      try {
        const priceNgn = await this.fetchCoinGeckoPrice(chain);
        await this.redis.set(cacheKey, priceNgn.toString(), 'EX', 60);
        this.logger.log(`CoinGecko price for ${chain}: ₦${priceNgn}`);
        return priceNgn;
      } catch (coinGeckoError) {
        const err = coinGeckoError as Error;
        this.logger.warn(`CoinGecko API failed for ${chain}: ${err.message}`);
      }

      // 3. Fallback Provider: Binance API + USD/NGN Rate
      try {
        const priceNgn = await this.fetchBinancePrice(chain);
        await this.redis.set(cacheKey, priceNgn.toString(), 'EX', 60);
        this.logger.log(`Binance price for ${chain}: ₦${priceNgn}`);
        return priceNgn;
      } catch (binanceError) {
        const err = binanceError as Error;
        this.logger.warn(`Binance API failed for ${chain}: ${err.message}`);
      }

      // 4. Emergency Fallback
      const emergencyRate = this.EMERGENCY_RATES[chain];
      this.logger.error(`[OracleService] Emergency fallback rates active for ${chain}: ₦${emergencyRate}`);
      await this.redis.set(cacheKey, emergencyRate.toString(), 'EX', 30); // Shorter cache for emergency
      return emergencyRate;

    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get price for ${chain}: ${err.message}`);
      // Return emergency rate as last resort
      return this.EMERGENCY_RATES[chain];
    }
  }

  /**
   * Fetch price from CoinGecko API (primary provider)
   */
  private async fetchCoinGeckoPrice(chain: SupportedChain): Promise<number> {
    const coinId = this.COINGECKO_IDS[chain];
    const url = `https://api.coingecko.com/api/v3/simple/price?ids=${coinId},tether&vs_currencies=ngn,usd`;

    const response = await firstValueFrom(
      this.httpService.get(url, {
        timeout: 10000,
      })
    );

    const data = response.data;

    if (!data || !data[coinId]) {
      throw new Error(`Invalid CoinGecko response for ${chain}`);
    }

    // Prefer NGN direct rate if available
    if (data[coinId].ngn) {
      return data[coinId].ngn;
    }

    // Fallback to USD rate with USDT/NGN conversion
    if (data[coinId].usd && data.tether?.ngn) {
      const usdPrice = data[coinId].usd;
      const usdtNgnRate = data.tether.ngn;
      return usdPrice * usdtNgnRate;
    }

    throw new Error(`No valid price data from CoinGecko for ${chain}`);
  }

  /**
   * Fetch price from Binance API (fallback provider)
   */
  private async fetchBinancePrice(chain: SupportedChain): Promise<number> {
    const symbol = this.BINANCE_SYMBOLS[chain];
    const url = `https://api.binance.com/api/v3/ticker/price?symbol=${symbol}`;

    const response = await firstValueFrom(
      this.httpService.get(url, {
        timeout: 10000,
      })
    );

    const data = response.data;

    if (!data || !data.price) {
      throw new Error(`Invalid Binance response for ${chain}`);
    }

    const usdPrice = parseFloat(data.price);
    
    // Try to get current USDT/NGN rate from CoinGecko for accurate conversion
    try {
      const usdtUrl = 'https://api.coingecko.com/api/v3/simple/price?ids=tether&vs_currencies=ngn';
      const usdtResponse = await firstValueFrom(
        this.httpService.get(usdtUrl, { timeout: 5000 })
      );
      
      if (usdtResponse.data?.tether?.ngn) {
        const usdtNgnRate = usdtResponse.data.tether.ngn;
        return usdPrice * usdtNgnRate;
      }
    } catch (error) {
      this.logger.warn('Failed to fetch USDT/NGN rate, using fallback');
    }

    // Fallback to static USDT/NGN rate
    return usdPrice * this.USDT_NGN_FALLBACK;
  }

  /**
   * Calculate crypto amount from NGN amount with fee markup
   * Fee structure: 5% fee, hard capped at ₦200 max
   */
  async calculateCryptoAmount(
    amountNgn: number,
    chain: SupportedChain
  ): Promise<{ cryptoAmount: number; rateNgn: number }> {
    try {
      const rateNgn = await this.getPriceInNgn(chain);
      
      // Calculate fee: 5% fee, hard capped at ₦200 max
      const feeNgn = Math.min(amountNgn * 0.05, 200);
      
      // Calculate net amount after fee
      const netAmountNgn = amountNgn - feeNgn;
      
      // Calculate crypto amount
      const cryptoAmount = Number((netAmountNgn / rateNgn).toFixed(6));

      this.logger.log(
        `Calculated ${chain} amount: ${cryptoAmount} (Rate: ₦${rateNgn}, Net: ₦${netAmountNgn}, Fee: ₦${feeNgn})`
      );

      // Only return cryptoAmount and rateNgn (fee breakdown not exposed to UI)
      return {
        cryptoAmount,
        rateNgn,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to calculate crypto amount: ${err.message}`);
      throw new Error(`Price calculation failed: ${err.message}`);
    }
  }

  /**
   * Get current rate information for display purposes
   */
  async getRateInfo(chain: SupportedChain): Promise<{ rateNgn: number; source: string }> {
    const cacheKey = `oracle:price:${chain}`;
    const cachedPrice = await this.redis.get(cacheKey);
    
    if (cachedPrice) {
      return {
        rateNgn: parseFloat(cachedPrice),
        source: 'cache',
      };
    }

    const rateNgn = await this.getPriceInNgn(chain);
    return {
      rateNgn,
      source: 'live',
    };
  }

  async onModuleDestroy() {
    await this.redis.quit();
  }
}
