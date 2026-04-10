const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: Set DEPLOYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("=== L3 Chain Status ===\n");
  
  const l3Provider = new ethers.JsonRpcProvider("http://127.0.0.1:8449");
  const wallet = new ethers.Wallet(privateKey, l3Provider);

  // Check chain IDs
  console.log("1. Network check...");
  const l3ChainId = (await l3Provider.getNetwork()).chainId;
  console.log(`   L3 Chain ID: ${l3ChainId}`);
  
  // Check block numbers
  const l3Block = await l3Provider.getBlockNumber();
  console.log(`   L3 Block: ${l3Block}`);
  
  // Check balances
  const l3Balance = await l3Provider.getBalance(wallet.address);
  console.log(`   Wallet: ${ethers.formatEther(l3Balance)} ETH`);
  
  console.log("\n=== Configuration ===");
  console.log("L2 Token Bridge: 0xF71C64F37A8AdA918b1fD7C7d9e3FC5aC6C813Ce");
  console.log("L3 Token Bridge: 0x3B298e17897548aEB02F52e6761ec578D195A21b");
  console.log("CureToken (L3): 0x2c45C5b9C2bcBD8Ed93FF2f6b1B562C5619FC937");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("Error:", error.message);
    process.exit(1);
  });