const { ethers } = require("ethers");

const L3_RPC = "http://127.0.0.1:8449";

// Batch poster account (from nodeConfig.json)
const BATCH_POSTER_KEY = "0xa85fa0e843880f0a681059743270f0ca69058d095fa180e9790f374349193b12";
const MAIN_WALLET = "0xa51B2CB15E4DE90dc242FB4d1ff1E93CC82dBA5D";

async function main() {
  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const batchPoster = new ethers.Wallet(BATCH_POSTER_KEY, provider);
  
  console.log("=== Batch Poster Account ===");
  console.log("Address:", batchPoster.address);
  
  const balance = await provider.getBalance(batchPoster.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance > ethers.parseEther("0.01")) {
    console.log("\n=== Sending ETH to Main Wallet ===");
    const tx = await batchPoster.sendTransaction({
      to: MAIN_WALLET,
      value: ethers.parseEther("0.01")
    });
    console.log("Transaction:", tx.hash);
    await tx.wait();
    console.log("Success!");
    
    // Check main wallet balance
    const mainBalance = await provider.getBalance(MAIN_WALLET);
    console.log("\nMain Wallet Balance:", ethers.formatEther(mainBalance), "ETH");
  } else {
    console.log("\nBatch poster has no ETH either!");
    console.log("Need to bridge ETH from L2.");
  }
}

main().catch(console.error);