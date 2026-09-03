import { Injectable, Logger, Inject } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { SupportedChain } from '@prisma/client';
import { 
  Connection, 
  PublicKey, 
  SystemProgram, 
  Transaction, 
  Keypair,
  sendAndConfirmTransaction,
  LAMPORTS_PER_SOL
} from '@solana/web3.js';
import { ethers } from 'ethers';
import bs58 from 'bs58';
import { 
  TonClient, 
  WalletContractV4, 
  internal, 
  toNano,
  Address
} from '@ton/ton';
import { mnemonicToPrivateKey } from '@ton/crypto';
import { getExplorerUrl } from './helpers/explorer.helper';
import { MailService } from '../mail/mail.service';

@Injectable()
export class Web3Service {
  private readonly logger = new Logger(Web3Service.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly mailService: MailService,
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
   * BSC EVM Transfer Engine
   * Transfers BNB from vault to target wallet on BSC testnet
   */
  private async transferBsc(targetWallet: string, amount: number): Promise<string> {
    try {
      const rpcUrl = this.configService.get<string>('BSC_RPC_URL');
      if (!rpcUrl) {
        throw new Error('BSC_RPC_URL not configured in environment variables');
      }

      const privateKey = this.configService.get<string>('BSC_VAULT_PRIVATE_KEY');
      if (!privateKey) {
        throw new Error('BSC_VAULT_PRIVATE_KEY not configured in environment variables');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);

      const tx = await wallet.sendTransaction({
        to: targetWallet,
        value: ethers.parseEther(amount.toString()),
      });

      await tx.wait(1); // Wait for 1 confirmation

      this.logger.log(`BSC transfer successful: ${tx.hash}`);
      return tx.hash;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`BSC transfer failed: ${err.message}`, err.stack);
      throw new Error(`BSC transfer failed: ${err.message}`);
    }
  }

  /**
   * TON Transfer Engine
   * Transfers TON from vault to target wallet on TON testnet
   */
  private async transferTon(targetWallet: string, amount: number): Promise<string> {
    try {
      const apiKey = this.configService.get<string>('TON_API_KEY');
      const endpoint =
        this.configService.get<string>('TON_RPC_URL') ||
        'https://testnet.toncenter.com/api/v2/jsonRPC';

      const client = new TonClient({
        endpoint,
        ...(apiKey ? { apiKey } : {}),
      });

      const mnemonic = this.configService.get<string>('TON_VAULT_MNEMONIC') || '';
      const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(' '));
      const walletContract = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
      });
      const wallet = client.open(walletContract);

      const seqno = await wallet.getSeqno();

      const transferCell = wallet.createTransfer({
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

      // Broadcast transfer cell to the network
      await wallet.send(transferCell);
      this.logger.log(`TON transfer broadcasted to network. Waiting for confirmation...`);

      // Configurable timeout settings
      const maxAttempts = this.configService.get<number>('TON_CONFIRMATION_MAX_ATTEMPTS') || 60;
      const pollInterval = this.configService.get<number>('TON_CONFIRMATION_POLL_INTERVAL') || 3000;

      // Poll until seqno increments (confirms block inclusion)
      let confirmed = false;
      for (let attempt = 0; attempt < maxAttempts; attempt++) {
        await new Promise((resolve) => setTimeout(resolve, pollInterval));
        try {
          const currentSeqno = await wallet.getSeqno();
          this.logger.log(`TON confirmation check ${attempt + 1}/${maxAttempts}: seqno ${seqno} -> ${currentSeqno}`);
          
          if (currentSeqno > seqno) {
            confirmed = true;
            this.logger.log(`TON transaction confirmed after ${attempt + 1} polling attempts`);
            break;
          }
        } catch (err) {
          // Catch transient RPC throttling during polling
          this.logger.warn(`TON confirmation polling attempt ${attempt + 1} failed: ${(err as Error).message}`);
        }
      }

      if (!confirmed) {
        throw new Error(`TON transaction failed to confirm on-chain within timeout window (${maxAttempts * pollInterval}ms).`);
      }

      // Fetch the latest transaction hash directly from the sender contract
      const transactions = await client.getTransactions(wallet.address, { limit: 1 });
      if (transactions.length > 0) {
        const txHash = transactions[0].hash().toString('hex');
        this.logger.log(`TON transfer successful: ${txHash}`);
        return txHash;
      }

      // Fallback to recipient account link if transaction hash cannot be resolved
      this.logger.warn(`TON transfer completed but transaction hash could not be resolved. Using target wallet as fallback.`);
      return targetWallet;
    } catch (error) {
      const err = error as Error;
      this.logger.error(`TON transfer failed: ${err.message}`, err.stack);
      throw new Error(`TON transfer failed: ${err.message}`);
    }
  }

  /**
   * Check vault balance for Solana
   */
  private async getSolanaBalance(): Promise<number> {
    try {
      const rpcUrl = this.configService.get<string>('SOLANA_RPC_URL');
      if (!rpcUrl) {
        throw new Error('SOLANA_RPC_URL not configured');
      }

      const connection = new Connection(rpcUrl, 'confirmed');
      const keypair = this.getSolanaKeypair();
      const balance = await connection.getBalance(keypair.publicKey);
      return balance / LAMPORTS_PER_SOL; // Convert lamports to SOL
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get Solana balance: ${err.message}`);
      return 0;
    }
  }

  /**
   * Check vault balance for Base (ETH)
   */
  private async getBaseBalance(): Promise<number> {
    try {
      const rpcUrl = this.configService.get<string>('BASE_RPC_URL');
      if (!rpcUrl) {
        throw new Error('BASE_RPC_URL not configured');
      }

      const privateKey = this.configService.get<string>('BASE_VAULT_PRIVATE_KEY');
      if (!privateKey) {
        throw new Error('BASE_VAULT_PRIVATE_KEY not configured');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get Base balance: ${err.message}`);
      return 0;
    }
  }

  /**
   * Check vault balance for TON
   */
  private async getTonBalance(): Promise<number> {
    try {
      const apiKey = this.configService.get<string>('TON_API_KEY');
      const endpoint =
        this.configService.get<string>('TON_RPC_URL') ||
        'https://testnet.toncenter.com/api/v2/jsonRPC';

      const client = new TonClient({
        endpoint,
        ...(apiKey ? { apiKey } : {}),
      });

      const mnemonic = this.configService.get<string>('TON_VAULT_MNEMONIC') || '';
      const keyPair = await mnemonicToPrivateKey(mnemonic.trim().split(' '));
      const walletContract = WalletContractV4.create({
        publicKey: keyPair.publicKey,
        workchain: 0,
      });
      const wallet = client.open(walletContract);

      const balance = await wallet.getBalance();
      return parseFloat(balance.toString()) / 1e9; // Convert nanoTON to TON
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get TON balance: ${err.message}`);
      return 0;
    }
  }

  /**
   * Check vault balance for BSC (BNB)
   */
  private async getBscBalance(): Promise<number> {
    try {
      const rpcUrl = this.configService.get<string>('BSC_RPC_URL');
      if (!rpcUrl) {
        throw new Error('BSC_RPC_URL not configured');
      }

      const privateKey = this.configService.get<string>('BSC_VAULT_PRIVATE_KEY');
      if (!privateKey) {
        throw new Error('BSC_VAULT_PRIVATE_KEY not configured');
      }

      const provider = new ethers.JsonRpcProvider(rpcUrl);
      const wallet = new ethers.Wallet(privateKey, provider);
      const balance = await provider.getBalance(wallet.address);
      return parseFloat(ethers.formatEther(balance));
    } catch (error) {
      const err = error as Error;
      this.logger.error(`Failed to get BSC balance: ${err.message}`);
      return 0;
    }
  }

  /**
   * Get vault balance for a specific chain
   */
  async getVaultBalance(chain: SupportedChain): Promise<number> {
    switch (chain) {
      case 'SOLANA':
        return await this.getSolanaBalance();
      case 'BASE':
        return await this.getBaseBalance();
      case 'TON':
        return await this.getTonBalance();
      case 'BSC':
        return await this.getBscBalance();
      default:
        throw new Error(`Unsupported chain: ${chain}`);
    }
  }

  /**
   * Unified Dispatch Method
   * Routes gas dispensing to the appropriate chain's transfer engine
   * Includes liquidity safety check before transfer
   */
  async dispenseGas(
    chain: SupportedChain, 
    targetWallet: string, 
    cryptoAmount: number
  ): Promise<{ txHash: string; explorerUrl: string } | { liquidityPending: true; message: string }> {
    this.logger.log(`Dispensing gas: ${chain} -> ${targetWallet}, amount: ${cryptoAmount}`);

    // Check vault balance before transfer
    const currentBalance = await this.getVaultBalance(chain);
    const requiredAmount = cryptoAmount + 0.01; // Add small buffer for gas fees

    if (currentBalance < requiredAmount) {
      const tokenSymbol = {
        SOLANA: 'SOL',
        BASE: 'ETH',
        TON: 'TON',
        BSC: 'BNB',
        USDT_TON: 'USDT',
        USDT_SOL: 'USDT',
        USDT_BSC: 'USDT',
        USDT_BASE: 'USDT',
      }[chain] || 'tokens';

      this.logger.warn(
        `Insufficient ${chain} vault balance: ${currentBalance} ${tokenSymbol} < ${requiredAmount} ${tokenSymbol}`
      );

      // Send alert to admin
      await this.mailService.sendLowBalanceAlert(chain, requiredAmount, currentBalance);

      // Return liquidity pending status
      return {
        liquidityPending: true,
        message: `Insufficient liquidity in ${chain} vault. Current: ${currentBalance.toFixed(6)} ${tokenSymbol}, Required: ${requiredAmount.toFixed(6)} ${tokenSymbol}`,
      };
    }

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
      case 'BSC':
        txHash = await this.transferBsc(targetWallet, cryptoAmount);
        break;
      case 'USDT_SOL':
        txHash = await this.transferSolanaUsdt(targetWallet, cryptoAmount);
        break;
      case 'USDT_BASE':
        txHash = await this.transferBaseUsdt(targetWallet, cryptoAmount);
        break;
      case 'USDT_TON':
        txHash = await this.transferTonUsdt(targetWallet, cryptoAmount);
        break;
      case 'USDT_BSC':
        txHash = await this.transferBscUsdt(targetWallet, cryptoAmount);
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

  /**
   * USDT Transfer Engines (to be implemented)
   * Currently throw errors as they require token-specific contract interactions
   */
  private async transferSolanaUsdt(targetWallet: string, amount: number): Promise<string> {
    throw new Error('USDT SOL transfers not yet implemented. Please configure SPL token contract.');
  }

  private async transferBaseUsdt(targetWallet: string, amount: number): Promise<string> {
    throw new Error('USDT BASE transfers not yet implemented. Please configure ERC20 token contract.');
  }

  private async transferTonUsdt(targetWallet: string, amount: number): Promise<string> {
    throw new Error('USDT TON transfers not yet implemented. Please configure Jetton token contract.');
  }

  private async transferBscUsdt(targetWallet: string, amount: number): Promise<string> {
    throw new Error('USDT BSC transfers not yet implemented. Please configure BEP20 token contract.');
  }
}
