require("dotenv").config();
const { ethers } = require("ethers");

const L3_RPC = process.env.L3_RPC || "http://127.0.0.1:8449";
const DEPLOYER_PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;

async function main() {
  if (!DEPLOYER_PRIVATE_KEY) {
    console.error("❌ Please set DEPLOYER_PRIVATE_KEY in .env");
    return;
  }

  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_PRIVATE_KEY, provider);

  console.log("=== Funding L3 ===");
  console.log("Deployer:", wallet.address);

  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");

  if (balance < ethers.parseEther("0.01")) {
    console.log("\n⚠️ Need to bridge ETH from L2");
  }
}

main().catch(console.error);