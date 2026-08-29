const { Keypair } = require('@solana/web3.js');
const { Wallet } = require('ethers');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');

async function generateVaults() {
  console.log("=== MASTER VAULT KEYS (TESTNET ONLY) ===\n");
  // 1. Solana Keypair
   const solanaKey = Keypair.generate();
  console.log("[SOLANA DEVNET]");
  console.log("Public Address:", solanaKey.publicKey.toBase58());
  console.log("Private Key (BS58):", Buffer.from(solanaKey.secretKey).toString('base64'));
  console.log("----------------------------------------");

   // 2. Base (EVM) Keypair
   const baseWallet = Wallet.createRandom();
   console.log("[BASE SEPOLIA]");
   console.log("Public Address:", baseWallet.address);
   console.log("Private Key:", baseWallet.privateKey);
   console.log("----------------------------------------");

  // 3. TON Keypair & Address Derivation
  const tonMnemonic = await mnemonicNew(24);
  const keyPair = await mnemonicToPrivateKey(tonMnemonic);
  const tonWallet = WalletContractV4.create({
    publicKey: keyPair.publicKey,
    workchain: 0,
  });

  // Testnet address format
  const tonAddress = tonWallet.address.toString({
    testOnly: true,
    bounceable: false,
  });

  console.log("[TON TESTNET]");
  console.log("Public Address (Testnet):", tonAddress);
  console.log("24-Word Mnemonic:", tonMnemonic.join(' '));
  console.log("========================================");
}

generateVaults();