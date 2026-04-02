require("dotenv").config();
const hre = require("hardhat");
const { ethers } = hre;

const L3_RPC = "http://127.0.0.1:8449";
const CHAIN_ID = 8937309580;

async function main() {
  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const wallet = new ethers.Wallet(process.env.DEPLOYER_PRIVATE_KEY, provider);
  
  console.log("=== Testing xCure L3 ===");
  console.log("Wallet:", wallet.address);
  console.log("Chain ID:", CHAIN_ID);
  console.log("RPC:", L3_RPC);
  
  // Check connection
  const network = await provider.getNetwork();
  console.log("Connected Network ChainID:", network.chainId);
  
  // Check balance
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  // Check block number
  const blockNum = await provider.getBlockNumber();
  console.log("Current Block:", blockNum);
  
  // Deploy a simple test contract
  console.log("\n=== Deploying Test Token ===");
  
  const TestToken = await ethers.getContractFactory("MockERC20", wallet);
  const token = await TestToken.deploy("xCure Test", "xCURE", 18);
  await token.waitForDeployment();
  
  const tokenAddress = await token.getAddress();
  console.log("Test Token deployed at:", tokenAddress);
  
  // Mint some tokens
  console.log("\n=== Minting Tokens ===");
  const mintTx = await token.mint(wallet.address, ethers.parseEther("1000000"));
  await mintTx.wait();
  console.log("Mint Transaction:", mintTx.hash);
  
  // Check balance
  const tokenBalance = await token.balanceOf(wallet.address);
  console.log("Token Balance:", ethers.formatEther(tokenBalance));
  
  console.log("\n=== Test Complete ===");
  console.log("Token Address:", tokenAddress);
  console.log("View in Blockscout: http://localhost/address/" + tokenAddress);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });