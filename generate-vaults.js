const { Keypair } = require('@solana/web3.js');
const { Wallet } = require('ethers');
const { mnemonicNew, mnemonicToPrivateKey } = require('@ton/crypto');
const { WalletContractV4 } = require('@ton/ton');

async function generateVaults() {
  try {
    console.log("=== MASTER VAULT KEYS ===\n");

    // 1. Solana Keypair
    // const solanaKey = Keypair.generate();
    // console.log("[SOLANA]");
    // console.log("Public Address:", solanaKey.publicKey.toBase58());
    // console.log("Private Key (BS58):", Buffer.from(solanaKey.secretKey).toString('base64'));
    // console.log("----------------------------------------");

    // 2. Base (EVM) Keypair
    // const baseWallet = Wallet.createRandom();
    // console.log("[BASE (EVM)]");
    // console.log("Public Address:", baseWallet.address);
    // console.log("Private Key:", baseWallet.privateKey);
    // console.log("----------------------------------------");

    // 3. BSC - BNB Smart Chain (EVM) Keypair
    console.log("Generating BSC wallet...");
    const bscWallet = Wallet.createRandom();
    console.log("[BSC SMART CHAIN (EVM)]");
    console.log("Public Address:", bscWallet.address);
    console.log("Private Key:", bscWallet.privateKey);
    console.log("----------------------------------------");

    // // 4. TON Keypair & Address Derivation
    // const tonMnemonic = await mnemonicNew(24);
    // const keyPair = await mnemonicToPrivateKey(tonMnemonic);
    // const tonWallet = WalletContractV4.create({
    //   publicKey: keyPair.publicKey,
    //   workchain: 0,
    // });

    // const tonAddress = tonWallet.address.toString({
    //   testOnly: false, // Set to false for Mainnet
    //   bounceable: false,
    // });

    // console.log("[TON]");
    // console.log("Public Address:", tonAddress);
    // console.log("24-Word Mnemonic:", tonMnemonic.join(' '));
    // console.log("========================================");
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