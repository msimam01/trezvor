import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma/prisma.service';
import { SupportedChain } from '@prisma/client';

@Injectable()
export class SettingsService implements OnModuleInit {
  private readonly logger = new Logger(SettingsService.name);

  constructor(private readonly prisma: PrismaService) {}

  async onModuleInit() {
    await this.seedDefaultConfigs();
  }

  private async seedDefaultConfigs() {
    try {
      // Seed SystemConfig
      const systemConfig = await this.prisma.systemConfig.findUnique({
        where: { id: 'global' },
      });

      if (!systemConfig) {
        await this.prisma.systemConfig.create({
          data: {
            id: 'global',
            platformFeePercent: 15.00,
          },
        });
        this.logger.log('Seeded default SystemConfig');
      }

      // Seed ChainConfigs
      const defaultChainConfigs = [
        { chain: SupportedChain.SOLANA, minAmountNaira: 500, isEnabled: true },
        { chain: SupportedChain.BASE, minAmountNaira: 700, isEnabled: true },
        { chain: SupportedChain.TON, minAmountNaira: 500, isEnabled: true },
      ];

      for (const config of defaultChainConfigs) {
        const existing = await this.prisma.chainConfig.findUnique({
          where: { chain: config.chain },
        });

        if (!existing) {
          await this.prisma.chainConfig.create({
            data: config,
          });
          this.logger.log(`Seeded default ChainConfig for ${config.chain}`);
        }
      }
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error seeding default configs: ${err.message}`, err.stack);
    }
  }

  async getGlobalFeePercent(): Promise<number> {
    try {
      const config = await this.prisma.systemConfig.findUnique({
        where: { id: 'global' },
      });

      if (!config) {
        this.logger.warn('SystemConfig not found, using default 15%');
        return 15.00;
      }

      return Number(config.platformFeePercent);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error getting global fee percent: ${err.message}`, err.stack);
      return 15.00; // Fallback to default
    }
  }

  async getChainConfig(chain: SupportedChain): Promise<{
    minAmountNaira: number;
    isEnabled: boolean;
  }> {
    try {
      const config = await this.prisma.chainConfig.findUnique({
        where: { chain },
      });

      if (!config) {
        this.logger.warn(`ChainConfig not found for ${chain}, using defaults`);
        return {
          minAmountNaira: 500,
          isEnabled: true,
        };
      }

      return {
        minAmountNaira: Number(config.minAmountNaira),
        isEnabled: config.isEnabled,
      };
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error getting chain config for ${chain}: ${err.message}`, err.stack);
      return {
        minAmountNaira: 500,
        isEnabled: true,
      };
    }
  }

  async getAllEnabledChains(): Promise<SupportedChain[]> {
    try {
      const configs = await this.prisma.chainConfig.findMany({
        where: { isEnabled: true },
        select: { chain: true },
      });

      return configs.map((config) => config.chain);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error getting enabled chains: ${err.message}`, err.stack);
      return [SupportedChain.SOLANA, SupportedChain.BASE, SupportedChain.TON]; // Fallback
    }
  }

  async updateGlobalFeePercent(feePercent: number): Promise<void> {
    try {
      await this.prisma.systemConfig.update({
        where: { id: 'global' },
        data: { platformFeePercent: feePercent },
      });
      this.logger.log(`Updated global fee percent to ${feePercent}%`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error updating global fee percent: ${err.message}`, err.stack);
      throw err;
    }
  }

  async updateChainConfig(
    chain: SupportedChain,
    minAmountNaira: number,
    isEnabled: boolean,
  ): Promise<void> {
    try {
      await this.prisma.chainConfig.upsert({
        where: { chain },
        update: { minAmountNaira, isEnabled },
        create: { chain, minAmountNaira, isEnabled },
      });
      this.logger.log(`Updated ChainConfig for ${chain}`);
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Error updating chain config for ${chain}: ${err.message}`, err.stack);
      throw err;
    }
  }
}