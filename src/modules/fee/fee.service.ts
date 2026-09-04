import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { HttpService } from '@nestjs/axios';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportedChain } from '@prisma/client';
import { firstValueFrom } from 'rxjs';
import { Connection, PublicKey, SystemProgram, Transaction, LAMPORTS_PER_SOL } from '@solana/web3.js';
import { ethers } from 'ethers';

interface FeeCalculationResult {
  networkGasFeeUsd: number;
  platformFeeUsd: number;
  totalFeeUsd: number;
  breakdown: {
    chain: string;
    estimatedGasCost: string;
    platformFeePercent: number;
    minFeeApplied: boolean;
  };
}

@Injectable()
export class FeeService {
  private readonly logger = new Logger(FeeService.name);

  // Default fallback fees in USD when RPC estimation fails
  private readonly FALLBACK_NETWORK_FEES: Record<string, number> = {
    SOLANA: 0.001,
    BASE: 0.01,
    BSC: 0.03,
    TON: 0.02,
    USDT_SOL: 0.001,
    USDT_BASE: 0.01,
    USDT_BSC: 0.03,
    USDT_TON: 0.02,
  };

  // Default platform fee percentage
  private readonly DEFAULT_PLATFORM_FEE_PERCENT = 5.0;
  private readonly MINIMUM_FEE_USD = 0.05;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly httpService: HttpService,
  ) {}

  /**
   * Calculate order fee with dynamic gas estimation and admin settings
   * @param chain - Blockchain network
   * @param tokenSymbol - Token symbol (for gas estimation)
   * @param tokenQuantityUsd - Token quantity in USD
   * @returns Fee calculation breakdown
   */
  async calculateOrderFee(
    chain: SupportedChain,
    tokenSymbol: string,
    tokenQuantityUsd: number,
  ): Promise<FeeCalculationResult> {
    try {
      this.logger.log(
        `[FeeService] Starting fee calculation for ${chain} ${tokenSymbol}, quantity: $${tokenQuantityUsd}`,
      );

      // 1. Estimate Blockchain Network Fee (USD)
      this.logger.log(`[FeeService] Step 1: Estimating network gas fee for ${chain}...`);
      const networkGasFeeUsd = await this.estimateNetworkGasFee(chain, tokenSymbol);
      this.logger.log(`[FeeService] ✓ Network gas fee estimated: $${networkGasFeeUsd.toFixed(6)} for ${chain}`);

      // 2. Calculate Admin Platform Service Fee (USD)
      this.logger.log(`[FeeService] Step 2: Fetching platform fee percentage from SystemConfig...`);
      const platformFeePercent = await this.getAdminPlatformFeePercent();
      this.logger.log(`[FeeService] ✓ Platform fee percentage: ${platformFeePercent}% from SystemConfig`);
      
      const platformFeeUsd = tokenQuantityUsd * (platformFeePercent / 100);
      this.logger.log(`[FeeService] ✓ Platform fee calculated: $${platformFeeUsd.toFixed(6)} (${platformFeePercent}% of $${tokenQuantityUsd})`);

      // 3. Calculate Total Combined Fee
      let totalFeeUsd = networkGasFeeUsd + platformFeeUsd;
      this.logger.log(`[FeeService] Step 3: Combined fee before minimum check: $${totalFeeUsd.toFixed(6)}`);

      // 4. Enforce minimum fee floor
      const minFeeApplied = totalFeeUsd < this.MINIMUM_FEE_USD;
      if (minFeeApplied) {
        totalFeeUsd = this.MINIMUM_FEE_USD;
        this.logger.log(
          `[FeeService] ⚠ Total fee $${totalFeeUsd.toFixed(6)} below minimum $${this.MINIMUM_FEE_USD}, applying minimum`,
        );
      } else {
        this.logger.log(`[FeeService] ✓ Total fee $${totalFeeUsd.toFixed(6)} meets minimum requirement`);
      }

      this.logger.log(
        `[FeeService] ✓ Fee calculation complete: Network gas: $${networkGasFeeUsd.toFixed(6)}, Platform: $${platformFeeUsd.toFixed(6)} (${platformFeePercent}%), Total: $${totalFeeUsd.toFixed(6)}`,
      );

      return {
        networkGasFeeUsd,
        platformFeeUsd,
        totalFeeUsd,
        breakdown: {
          chain,
          estimatedGasCost: `${networkGasFeeUsd.toFixed(6)} USD`,
          platformFeePercent,
          minFeeApplied,
        },
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[FeeService] ✗ Error calculating order fee: ${err.message}`, err.stack);
      
      // Return fallback calculation on error
      this.logger.log(`[FeeService] ⚠ Using fallback fee calculation due to error`);
      return this.getFallbackFeeCalculation(chain, tokenSymbol, tokenQuantityUsd);
    }
  }

  /**
   * Estimate network gas fee using RPC calls
   */
  private async estimateNetworkGasFee(
    chain: SupportedChain,
    tokenSymbol: string,
  ): Promise<number> {
    try {
      this.logger.log(`[FeeService] -> Starting gas estimation for ${chain} (${tokenSymbol})`);
      
      switch (chain) {
        case 'SOLANA':
        case 'USDT_SOL':
          return await this.estimateSolanaGasFee();
        case 'BASE':
        case 'USDT_BASE':
          return await this.estimateEvmGasFee('BASE');
        case 'BSC':
        case 'USDT_BSC':
          return await this.estimateEvmGasFee('BSC');
        case 'TON':
        case 'USDT_TON':
          return await this.estimateTonGasFee();
        default:
          this.logger.warn(`[FeeService] -> ⚠ Unsupported chain for gas estimation: ${chain}, using fallback`);
          return this.FALLBACK_NETWORK_FEES[chain] || 0.01;
      }
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`[FeeService] -> ⚠ RPC gas estimation failed for ${chain}: ${err.message}, using fallback`);
      return this.FALLBACK_NETWORK_FEES[chain] || 0.01;
    }
  }

  /**
   * Estimate Solana gas fee using RPC
   */
  private async estimateSolanaGasFee(): Promise<number> {
    try {
      this.logger.log(`[FeeService] -> -> Solana: Calling RPC getFeeForMessage...`);
      const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL');
      if (!rpcUrl) {
        throw new Error('SOLANA_RPC_URL not configured');
      }

      const connection = new Connection(rpcUrl, 'confirmed');
      
      // Create a sample transfer transaction to estimate fee
      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: PublicKey.default, // Dummy address
          toPubkey: PublicKey.default,   // Dummy address
          lamports: 1000,                 // Small amount
        }),
      );

      // Get fee for message
      const fee = await connection.getFeeForMessage(
        transaction.compileMessage(),
        'confirmed',
      );

      if (!fee.value) {
        throw new Error('Unable to estimate Solana fee');
      }

      // Convert lamports to SOL
      const solFee = fee.value / LAMPORTS_PER_SOL;
      this.logger.log(`[FeeService] -> -> Solana: RPC returned ${fee.value} lamports = ${solFee.toFixed(9)} SOL`);

      // Convert SOL to USD (using CoinGecko)
      this.logger.log(`[FeeService] -> -> Solana: Fetching SOL/USD price from CoinGecko...`);
      const solUsdPrice = await this.getTokenUsdPrice('solana');
      this.logger.log(`[FeeService] -> -> Solana: SOL/USD price = $${solUsdPrice}`);
      
      const feeUsd = solFee * solUsdPrice;
      this.logger.log(`[FeeService] -> -> ✓ Solana gas estimate: ${solFee.toFixed(9)} SOL = $${feeUsd.toFixed(6)} USD`);
      
      return feeUsd;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`[FeeService] -> -> ⚠ Solana gas estimation failed: ${err.message}, using fallback $${this.FALLBACK_NETWORK_FEES.SOLANA}`);
      return this.FALLBACK_NETWORK_FEES.SOLANA;
    }
  }

  /**
   * Estimate EVM gas fee (Base/BSC) using RPC
   */
  private async estimateEvmGasFee(network: 'BASE' | 'BSC'): Promise<number> {
    try {
      this.logger.log(`[FeeService] -> -> ${network}: Calling RPC getFeeData...`);
      const rpcUrl = this.configService.get<string>(
        network === 'BASE' ? 'BASE_RPC_URL' : 'BSC_RPC_URL',
      );
      if (!rpcUrl) {
        throw new Error(`${network}_RPC_URL not configured`);
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const feeData = await provider.getFeeData();

      if (!feeData.gasPrice) {
        throw new Error('Unable to get gas price');
      }

      // Estimate gas for token transfer (65000 units is standard for ERC20/BEP20 transfers)
      const estimatedGasUnits = 65000;
      const gasPriceGwei = parseFloat(ethers.formatUnits(feeData.gasPrice, 'gwei'));
      const gasCostEth = (gasPriceGwei * estimatedGasUnits) / 1e9; // Convert to ETH
      
      this.logger.log(`[FeeService] -> -> ${network}: RPC returned gas price ${gasPriceGwei.toFixed(2)} gwei`);
      this.logger.log(`[FeeService] -> -> ${network}: Estimated gas cost ${gasCostEth.toFixed(9)} ${network === 'BASE' ? 'ETH' : 'BNB'} (65,000 gas units)`);

      // Get native token price in USD
      const tokenId = network === 'BASE' ? 'ethereum' : 'binancecoin';
      this.logger.log(`[FeeService] -> -> ${network}: Fetching ${network === 'BASE' ? 'ETH' : 'BNB'}/USD price from CoinGecko...`);
      const tokenUsdPrice = await this.getTokenUsdPrice(tokenId);
      this.logger.log(`[FeeService] -> -> ${network}: ${network === 'BASE' ? 'ETH' : 'BNB'}/USD price = $${tokenUsdPrice}`);
      
      const feeUsd = gasCostEth * tokenUsdPrice;
      this.logger.log(`[FeeService] -> -> ✓ ${network} gas estimate: ${gasCostEth.toFixed(9)} ${network === 'BASE' ? 'ETH' : 'BNB'} = $${feeUsd.toFixed(6)} USD`);
      
      return feeUsd;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`[FeeService] -> -> ⚠ ${network} gas estimation failed: ${err.message}, using fallback $${this.FALLBACK_NETWORK_FEES[network]}`);
      return this.FALLBACK_NETWORK_FEES[network];
    }
  }

  /**
   * Estimate TON gas fee
   */
  private async estimateTonGasFee(): Promise<number> {
    try {
      this.logger.log(`[FeeService] -> -> TON: Using standard 0.005 TON fee estimation`);
      
      // TON has relatively stable gas fees, typically around 0.005 TON for standard transfers
      const tonFee = 0.005;

      // Get TON price in USD
      this.logger.log(`[FeeService] -> -> TON: Fetching TON/USD price from CoinGecko...`);
      const tonUsdPrice = await this.getTokenUsdPrice('the-open-network');
      this.logger.log(`[FeeService] -> -> TON: TON/USD price = $${tonUsdPrice}`);
      
      const feeUsd = tonFee * tonUsdPrice;
      this.logger.log(`[FeeService] -> -> ✓ TON gas estimate: ${tonFee} TON = $${feeUsd.toFixed(6)} USD`);
      
      return feeUsd;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`[FeeService] -> -> ⚠ TON gas estimation failed: ${err.message}, using fallback $${this.FALLBACK_NETWORK_FEES.TON}`);
      return this.FALLBACK_NETWORK_FEES.TON;
    }
  }

  /**
   * Get token USD price from CoinGecko
   */
  private async getTokenUsdPrice(tokenId: string): Promise<number> {
    try {
      const url = `https://api.coingecko.com/api/v3/simple/price?ids=${tokenId}&vs_currencies=usd`;
      const response = await firstValueFrom(
        this.httpService.get(url, { timeout: 5000 }),
      );

      if (!response.data?.[tokenId]?.usd) {
        throw new Error(`Invalid price response for ${tokenId}`);
      }

      return response.data[tokenId].usd;
    } catch (error) {
      const err = error as Error;
      this.logger.warn(`Failed to get USD price for ${tokenId}: ${err.message}`);
      
      // Return conservative fallback prices
      const fallbackPrices: Record<string, number> = {
        solana: 150,      // $150 SOL
        ethereum: 3000,   // $3000 ETH
        binancecoin: 600, // $600 BNB
        'the-open-network': 6, // $6 TON
      };
      
      return fallbackPrices[tokenId] || 1;
    }
  }

  /**
   * Get admin platform fee percentage from SystemConfig
   */
  private async getAdminPlatformFeePercent(): Promise<number> {
    try {
      this.logger.log(`[FeeService] -> Querying SystemConfig table for platformFeePercent...`);
      const config = await this.prisma.systemConfig.findUnique({
        where: { id: 'global' },
      });

      // Use platformFeePercent from SystemConfig if set, otherwise fallback to default
      if (config?.platformFeePercent !== null && config?.platformFeePercent !== undefined) {
        const feePercent = Number(config.platformFeePercent);
        this.logger.log(`[FeeService] -> ✓ Found platformFeePercent in SystemConfig: ${feePercent}%`);
        return feePercent;
      }

      this.logger.log(`[FeeService] -> ⚠ platformFeePercent not set in SystemConfig, using default: ${this.DEFAULT_PLATFORM_FEE_PERCENT}%`);
      return this.DEFAULT_PLATFORM_FEE_PERCENT;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`[FeeService] -> ✗ Error querying SystemConfig: ${err.message}, using default ${this.DEFAULT_PLATFORM_FEE_PERCENT}%`);
      return this.DEFAULT_PLATFORM_FEE_PERCENT;
    }
  }

  /**
   * Fallback fee calculation when errors occur
   */
  private getFallbackFeeCalculation(
    chain: SupportedChain,
    tokenSymbol: string,
    tokenQuantityUsd: number,
  ): FeeCalculationResult {
    const networkGasFeeUsd = this.FALLBACK_NETWORK_FEES[chain] || 0.01;
    const platformFeeUsd = tokenQuantityUsd * (this.DEFAULT_PLATFORM_FEE_PERCENT / 100);
    let totalFeeUsd = networkGasFeeUsd + platformFeeUsd;

    const minFeeApplied = totalFeeUsd < this.MINIMUM_FEE_USD;
    if (minFeeApplied) {
      totalFeeUsd = this.MINIMUM_FEE_USD;
    }

    this.logger.warn(`Using fallback fee calculation for ${chain}`);

    return {
      networkGasFeeUsd,
      platformFeeUsd,
      totalFeeUsd,
      breakdown: {
        chain,
        estimatedGasCost: `${networkGasFeeUsd.toFixed(6)} USD (fallback)`,
        platformFeePercent: this.DEFAULT_PLATFORM_FEE_PERCENT,
        minFeeApplied,
      },
    };
  }
}
