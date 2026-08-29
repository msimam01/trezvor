import { SupportedChain } from '@prisma/client';

export function getExplorerUrl(chain: SupportedChain, txHash: string): string {
  switch (chain) {
    case 'SOLANA':
      return `https://solscan.io/tx/${txHash}?cluster=devnet`;
    case 'BASE':
      return `https://sepolia.basescan.org/tx/${txHash}`;
    case 'TON':
      return `https://testnet.tonviewer.com/${txHash}`;
    default:
      return '#';
  }
}
