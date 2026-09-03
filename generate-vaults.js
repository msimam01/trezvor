const { Keypair } = require('@solana/web3.js');
const { Wallet } = require('ethers');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');

async function generateVaults() {
  try {
    console.log("=== MASTER VAULT KEYS ===\n");

    // 1. Solana Keypair (for SOL)
    const solanaKey = Keypair.generate();
    console.log("[SOLANA]");
    console.log("Public Address:", solanaKey.publicKey.toBase58());
    console.log("Private Key (Base64):", Buffer.from(solanaKey.secretKey).toString('base64'));
    console.log("----------------------------------------");

    // 2. Solana Keypair (for USDT)
    const solanaUsdtKey = Keypair.generate();
    console.log("[USDT_SOL]");
    console.log("Public Address:", solanaUsdtKey.publicKey.toBase58());
    console.log("Private Key (Base64):", Buffer.from(solanaUsdtKey.secretKey).toString('base64'));
    console.log("----------------------------------------");

    // 3. Base (EVM) Keypair (for ETH)
    const baseWallet = Wallet.createRandom();
    console.log("[BASE (EVM)]");
    console.log("Public Address:", baseWallet.address);
    console.log("Private Key:", baseWallet.privateKey);
    console.log("----------------------------------------");

    // 4. Base (EVM) Keypair (for USDT)
    const baseUsdtWallet = Wallet.createRandom();
    console.log("[USDT_BASE (EVM)]");
    console.log("Public Address:", baseUsdtWallet.address);
    console.log("Private Key:", baseUsdtWallet.privateKey);
    console.log("----------------------------------------");

    // 5. BSC - BNB Smart Chain (EVM) Keypair (for BNB)
    console.log("Generating BSC wallet...");
    const bscWallet = Wallet.createRandom();
    console.log("[BSC SMART CHAIN (EVM)]");
    console.log("Public Address:", bscWallet.address);
    console.log("Private Key:", bscWallet.privateKey);
    console.log("----------------------------------------");

    // 6. BSC - BNB Smart Chain (EVM) Keypair (for USDT)
    const bscUsdtWallet = Wallet.createRandom();
    console.log("[USDT_BSC (EVM)]");
    console.log("Public Address:", bscUsdtWallet.address);
    console.log("Private Key:", bscUsdtWallet.privateKey);
    console.log("----------------------------------------");

    // 7. TON Keypair & Address Derivation (for TON)
    const tonMnemonic = await mnemonicNew(24);
    const keyPair = await mnemonicToPrivateKey(tonMnemonic);
    const tonWallet = WalletContractV4.create({
      publicKey: keyPair.publicKey,
      workchain: 0,
    });

    const tonAddress = tonWallet.address.toString({
      testOnly: false, // Set to false for Mainnet
      bounceable: false,
    });

    console.log("[TON]");
    console.log("Public Address:", tonAddress);
    console.log("24-Word Mnemonic:", tonMnemonic.join(' '));
    console.log("----------------------------------------");

    // 8. TON Keypair & Address Derivation (for USDT)
    const tonUsdtMnemonic = await mnemonicNew(24);
    const tonUsdtKeyPair = await mnemonicToPrivateKey(tonUsdtMnemonic);
    const tonUsdtWallet = WalletContractV4.create({
      publicKey: tonUsdtKeyPair.publicKey,
      workchain: 0,
    });

    const tonUsdtAddress = tonUsdtWallet.address.toString({
      testOnly: false, // Set to false for Mainnet
      bounceable: false,
    });

    console.log("[USDT_TON]");
    console.log("Public Address:", tonUsdtAddress);
    console.log("24-Word Mnemonic:", tonUsdtMnemonic.join(' '));
    console.log("========================================");
  } catch (error) {
    console.error("Error generating vaults:", error);
    process.exit(1);
  }
  
}

generateVaults().then(() => {
  console.log("Vault generation complete!");
  process.exit(0);
}).catch((error) => {
  console.error("Fatal error:", error);
  process.exit(1);
});