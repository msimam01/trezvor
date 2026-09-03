import { SupportedChain } from '@prisma/client';

export function getExplorerUrl(chain: SupportedChain, txHash: string): string {
  switch (chain) {
    case 'SOLANA':
      return `https://solscan.io/tx/${txHash}?cluster=devnet`;
    case 'BASE':
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case 'TON':
      // Check if it's a wallet address (starts with specific characters) or transaction hash
      // TON addresses typically start with specific characters and are longer than tx hashes
      if (txHash.startsWith('UQ') || txHash.startsWith('EQ') || txHash.startsWith('0:')) {
        return `https://testnet.tonviewer.com/account/${txHash}`;
      }
      return `https://testnet.tonviewer.com/transaction/${txHash}`;
    case 'BSC':
      return `https://testnet.bscscan.com/tx/${txHash}`;
    default:
      return '#';
  }
}
