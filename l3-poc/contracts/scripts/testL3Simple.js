const { ethers } = require("ethers");

const L3_RPC = process.env.L3_RPC || "http://127.0.0.1:8449";
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

async function main() {
  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log("=== Checking xCure L3 ===");
  console.log("Wallet:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  const blockNum = await provider.getBlockNumber();
  console.log("Current Block:", blockNum);
  
  // Get fee data
  const feeData = await provider.getFeeData();
  console.log("Gas Price:", feeData.gasPrice?.toString());
  
  console.log("\n=== Deploying Simple Contract ===");
  
  // Simple storage contract bytecode
  const bytecode = "0x6080604052348015600f57600080fd5b5060b78061001e6000396000f3fe";
  
  try {
    const response = await wallet.sendTransaction({
      to: "0x0000000000000000000000000000000000000000",
      data: bytecode,
      gasLimit: 100000,
    });
    console.log("Tx sent:", response.hash);
    await response.wait();
    console.log("Success! Block:", response.blockNumber);
    console.log("Contract deployed!");
  } catch (e) {
    console.log("Deploy error:", e.message);
  }
}

main().catch(console.error);