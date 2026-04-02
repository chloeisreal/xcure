require("dotenv").config();
const hre = require("hardhat");
const { ethers } = require("ethers");

const L3_RPC = process.env.L3_RPC || "http://127.0.0.1:3347";
const L3_CHAIN_ID = parseInt(process.env.L3_CHAIN_ID) || 333333;
const DEPLOYER_KEY = process.env.DEPLOYER_PRIVATE_KEY;

async function main() {
  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
  
  console.log("=== Local L3 Deployment ===");
  console.log("RPC:", L3_RPC);
  console.log("Chain ID:", L3_CHAIN_ID);
  console.log("Deployer:", wallet.address);
  
  // Check connection
  const network = await provider.getNetwork();
  console.log("Connected Network:", network.chainId);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  // Get current nonce
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log("Nonce:", nonce);
  
  // Get latest block
  const blockNum = await provider.getBlockNumber();
  console.log("Latest Block:", blockNum);
  
  console.log("\n--- Ready to Deploy ---");
  console.log("You can now deploy contracts to local L3!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });