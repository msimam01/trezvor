import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportedChain } from '@prisma/client';
import { 
  Connection, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  Keypair,
  sendAndConfirmTransaction 
} from '@solana/web3.js';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { 
  TonClient, 
  WalletContractV4, 
  internal, 
  toNano 
} from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { getExplorerUrl } from './helpers/explorer.helper';

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);

  constructor(
    private readonly configService: ConfigService,
  ) {}

  /**
   * Robust Solana Private Key Parser
   * Handles Base58, Base64, and JSON array formats
   */
  private getSolanaKeypair(): Keypair {
    const rawKey = this.configService.get<string>('SOLANA_VAULT_PRIVATE_KEY') || '';
    const cleanedKey = rawKey.trim().replace(/^["']|["']$/g, '');

    if (!cleanedKey) {
      throw new Error('SOLANA_VAULT_PRIVATE_KEY is missing from environment variables');
    }

    try {
      // 1. JSON Array format: [12, 34, 56, ...]
      if (cleanedKey.startsWith('[') && cleanedKey.endsWith(']')) {
        const parsedArray = Uint8Array.from(JSON.parse(cleanedKey));
        return Keypair.fromSecretKey(parsedArray);
      }

      // 2. Base64 format (contains '+', '/', or ends with '=')
      if (cleanedKey.includes('+') || cleanedKey.includes('/') || cleanedKey.endsWith('=')) {
        const buffer = Buffer.from(cleanedKey, 'base64');
        if (buffer.length === 64) {
          return Keypair.fromSecretKey(Uint8Array.from(buffer));
        }
      }

      // 3. Fallback to Base58 format
      return Keypair.fromSecretKey(bs58.decode(cleanedKey));
    } catch (error) {
      const err = error as Error;
      throw new Error(`Failed to parse SOLANA_VAULT_PRIVATE_KEY: ${err.message}`);
    }
  }

  /**
   * Solana Transfer Engine
   * Transfers SOL from vault to target wallet
   */
  private async transferSolana(targetWallet: string, amount: number): Promise<string> {
    try {
      const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL');
      if (!rpcUrl) {
        throw new Error('SOLANA_RPC_URL not configured in environment variables');
      }

      const connection = new Connection(rpcUrl, 'confirmed');
      const keypair = this.getSolanaKeypair();

      const transaction = new Transaction().add(
        SystemProgram.transfer({
          fromPubkey: keypair.publicKey,
          toPubkey: new PublicKey(targetWallet),
          lamports: Math.round(amount * 1e9), // Convert SOL to lamports
        })
      );

      const signature = await sendAndConfirmTransaction(
        connection,
        transaction,
        [keypair]
      );

      this.logger.log(`Solana transfer successful: ${signature}`);
      return signature;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Solana transfer failed: ${err.message}`, err.stack);
      throw new Error(`Solana transfer failed: ${err.message}`);
    }
  }

  /**
   * Base EVM Transfer Engine
   * Transfers ETH from vault to target wallet on Base Sepolia
   */
  private async transferBase(targetWallet: string, amount: number): Promise<string> {
    try {
      const rpcUrl = this.configService.get<string>('BASE_RPC_URL');
      if (!rpcUrl) {
        throw new Error('BASE_RPC_URL not configured in environment variables');
      }

      const privateKey = this.configService.get<string>('BASE_VAULT_PRIVATE_KEY');
      if (!privateKey) {
        throw new Error('BASE_VAULT_PRIVATE_KEY not configured in environment variables');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tx = await wallet.sendTransaction({
        to: targetWallet,
        value: ethers.parseEther(amount.toString()),
      });

      await tx.wait(1); // Wait for 1 confirmation

      this.logger.log(`Base transfer successful: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Base transfer failed: ${err.message}`, err.stack);
      throw new Error(`Base transfer failed: ${err.message}`);
    }
  }

  /**
   * TON Transfer Engine
   * Transfers TON from vault to target wallet on TON testnet
   */
  private async transferTon(targetWallet: string, amount: number): Promise<string> {
    try {
      const rpcUrl = this.configService.get<string>('TON_RPC_URL');
      if (!rpcUrl) {
        throw new Error('TON_RPC_URL not configured in environment variables');
      }

      const mnemonic = this.configService.get<string>('TON_VAULT_MNEMONIC');
      if (!mnemonic) {
        throw new Error('TON_VAULT_MNEMONIC not configured in environment variables');
      }

      const client = new TonClient({ endpoint: rpcUrl });
      const mnemonicWords = mnemonic.split(' ').filter(word => word.length > 0);
      
      if (mnemonicWords.length !== 24) {
        throw new Error('TON_VAULT_MNEMONIC must be exactly 24 words');
      }

      const keyPair = await mnemonicToPrivateKey(mnemonicWords);
      const contract = WalletContractV4.create({ 
        publicKey: keyPair.publicKey, 
        workchain: 0 
      });

      // Open contract with client
      const contractProvider = client.open(contract);

      // Get current seqno
      let seqno: number;
      try {
        seqno = await contractProvider.getSeqno();
      } catch (error) {
        // If wallet not yet initialized, seqno is 0
        seqno = 0;
      }

      // Send transfer
      await contractProvider.sendTransfer({
        seqno,
        secretKey: keyPair.secretKey,
        messages: [
          internal({
            to: targetWallet,
            value: toNano(amount.toString()),
            bounce: false,
          }),
        ],
      });

      // Poll until seqno increments to confirm on-chain delivery
      const maxAttempts = 30;
      const pollInterval = 2000; // 2 seconds
      
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise(resolve => setTimeout(resolve, pollInterval));
        
        try {
          const currentSeqno = await contractProvider.getSeqno();
          if (currentSeqno > seqno) {
            // Transaction confirmed - generate a transaction hash
            // For TON, we'll use a combination of seqno and timestamp as the hash
            const txHash = Buffer.from(
              `${seqno}-${Date.now()}-${targetWallet.slice(0, 8)}`
            ).toString('base64');
            
            this.logger.log(`TON transfer successful: ${txHash}`);
            return txHash;
          }
        } catch (error) {
          // Wallet might not be initialized yet, continue polling
          if (attempt === maxAttempts - 1) {
            throw new Error('TON transfer confirmation timeout');
          }
        }
      }

      throw new Error('TON transfer confirmation timeout');
    } catch (error) {
      const err = error as Error;
      this.logger.error(`TON transfer failed: ${err.message}`, err.stack);
      throw new Error(`TON transfer failed: ${err.message}`);
    }
  }

  /**
   * Unified Dispatch Method
   * Routes gas dispensing to the appropriate chain's transfer engine
   */
  async dispenseGas(
    chain: SupportedChain, 
    targetWallet: string, 
    cryptoAmount: number
  ): Promise<{ txHash: string; explorerUrl: string }> {
    this.logger.log(`Dispensing gas: ${chain} -> ${targetWallet}, amount: ${cryptoAmount}`);

    let txHash: string;

    switch (chain) {
      case 'SOLANA':
        txHash = await this.transferSolana(targetWallet, cryptoAmount);
        break;
      case 'BASE':
        txHash = await this.transferBase(targetWallet, cryptoAmount);
        break;
      case 'TON':
        txHash = await this.transferTon(targetWallet, cryptoAmount);
        break;
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }

    const explorerUrl = getExplorerUrl(chain, txHash);
    
    return {
      txHash,
      explorerUrl,
    };
  }
}
