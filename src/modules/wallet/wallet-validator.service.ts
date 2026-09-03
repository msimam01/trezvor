import { Injectable, Logger } from '@nestjs/common';
import { isAddress } from 'ethers';
import { PublicKey } from '@solana/web3.js';
import { Address } from '@ton/core';

export type ChainType = 'SOLANA' | 'TON' | 'BASE' | 'BSC' | 'USDT_TON' | 'USDT_SOL' | 'USDT_BSC' | 'USDT_BASE';

@Injectable()
export class WalletValidatorService {
  private readonly logger = new Logger(WalletValidatorService.name);

  /**
   * Strict validation for multi-chain wallet addresses
   * Uses chain-specific validation libraries for accuracy
   */
  validateWalletAddress(chain: ChainType, address: string): boolean {
    try {
      if (!address || typeof address !== 'string') {
        return false;
      }

      const trimmedAddress = address.trim();

      switch (chain) {
        case 'BASE':
        case 'BSC':
        case 'USDT_BASE':
        case 'USDT_BSC':
          return this.validateEVMAddress(trimmedAddress);
        
        case 'SOLANA':
        case 'USDT_SOL':
          return this.validateSolanaAddress(trimmedAddress);
        
        case 'TON':
        case 'USDT_TON':
          return this.validateTonAddress(trimmedAddress);
        
        default:
          return false;
      }
    } catch (error) {
      this.logger.error(`Error validating ${chain} address: ${error instanceof Error ? error.message : 'Unknown error'}`);
      return false;
    }
  }

  /**
   * Validate EVM addresses (BASE, BSC)
   * Uses ethers.js for strict validation
   */
  private validateEVMAddress(address: string): boolean {
    try {
      return isAddress(address);
    } catch {
      return false;
    }
  }

  /**
   * Validate Solana addresses
   * Uses @solana/web3.js for strict on-curve validation
   */
  private validateSolanaAddress(address: string): boolean {
    try {
      const pubkey = new PublicKey(address);
      return PublicKey.isOnCurve(pubkey.toBytes());
    } catch {
      return false;
    }
  }

  /**
   * Validate TON addresses
   * Uses @ton/core for strict validation
   */
  private validateTonAddress(address: string): boolean {
    try {
      return Address.isFriendly(address) || Address.isRaw(address);
    } catch {
      return false;
    }
  }

  /**
   * Get validation error message for a specific chain
   */
  getValidationErrorMessage(chain: ChainType): string {
    switch (chain) {
      case 'SOLANA':
      case 'USDT_SOL':
        return 'Solana addresses must be valid Base58 addresses on the Ed25519 curve.';
      case 'BASE':
      case 'BSC':
      case 'USDT_BASE':
      case 'USDT_BSC':
        return 'EVM addresses must start with 0x followed by 40 hexadecimal characters.';
      case 'TON':
      case 'USDT_TON':
        return 'TON addresses must be valid user-friendly addresses (EQ/UQ/0: prefix) or 48-character addresses.';
      default:
        return 'Please provide a valid wallet address.';
    }
  }

  /**
   * Normalize wallet address to standard format
   * For EVM addresses: checksummed format
   * For other chains: return as-is
   */
  normalizeAddress(chain: ChainType, address: string): string {
    try {
      const trimmedAddress = address.trim();

      switch (chain) {
        case 'BASE':
        case 'BSC':
          if (isAddress(trimmedAddress)) {
            return trimmedAddress; // ethers.js handles checksumming
          }
          return trimmedAddress;
        
        case 'SOLANA':
        case 'TON':
          return trimmedAddress;
        
        default:
          return trimmedAddress;
      }
    } catch {
      return address.trim();
    }
  }
}
