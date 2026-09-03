import { PublicKey } from '@solana/web3.js';

export type ChainType = 'SOLANA' | 'BASE' | 'TON' | 'BSC';

export function validateWalletAddress(chain: ChainType, address: string): boolean {
  if (!address || typeof address !== 'string') {
    return false;
  }

  const trimmedAddress = address.trim();

  switch (chain) {
    case 'SOLANA':
      return validateSolanaAddress(trimmedAddress);
    
    case 'BASE':
    case 'BSC':
      return validateBaseAddress(trimmedAddress);
    
    case 'TON':
      return validateTonAddress(trimmedAddress);
    
    default:
      return false;
  }
}

function validateSolanaAddress(address: string): boolean {
  try {
    const key = new PublicKey(address);
    return PublicKey.isOnCurve(key.toBuffer());
  } catch {
    return false;
  }
}

function validateBaseAddress(address: string): boolean {
  // EVM address validation: 0x prefix followed by 40 hexadecimal characters
  return /^0x[a-fA-F0-9]{40}$/.test(address);
}

function validateTonAddress(address: string): boolean {
  // Validate standard user-friendly TON addresses
  // Format: EQ... (bounceable), UQ... (non-bounceable), or 0:... (raw)
  // Also accepts 48-character user-friendly format without prefix
  const userFriendlyPattern = /^(EQ|UQ|0:)[a-zA-Z0-9_-]{46,48}$/;
  const rawPattern = /^[a-zA-Z0-9_-]{48}$/;
  
  return userFriendlyPattern.test(address) || rawPattern.test(address);
}

export function getValidationErrorMessage(chain: ChainType): string {
  switch (chain) {
    case 'SOLANA':
      return 'Solana addresses must be valid Base58 addresses on the Ed25519 curve.';
    case 'BASE':
    case 'BSC':
      return 'EVM addresses must start with 0x followed by 40 hexadecimal characters.';
    case 'TON':
      return 'TON addresses must be valid user-friendly addresses (EQ/UQ/0: prefix) or 48-character addresses.';
    default:
      return 'Please provide a valid wallet address.';
  }
}