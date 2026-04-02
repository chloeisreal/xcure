const { ethers } = require("ethers");

const L3_RPC = "http://127.0.0.1:8449";
const PRIVATE_KEY = "0xe9d61d1a9f2d792a869072645f0cbf2f298a2e97bf37cdce8f1e00f29fcfa00e";

const artifact = require("/Users/hanklau/Downloads/xcure-main/l3-poc/contracts/artifacts/contracts/CureToken.sol/CureToken.json");

async function main() {
  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log("=== Testing xCure L3 ===");
  console.log("Wallet:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  const blockNum = await provider.getBlockNumber();
  console.log("Current Block:", blockNum);
  
  console.log("\n=== Deploying CureToken ===");
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const token = await factory.deploy();
  await token.waitForDeployment();
  
  const tokenAddress = await token.getAddress();
  console.log("Token deployed at:", tokenAddress);
  
  console.log("\n=== Minting Tokens ===");
  try {
    const mintTx = await token.mint(wallet.address, ethers.parseEther("1000000"));
    await mintTx.wait();
    console.log("Mint tx:", mintTx.hash);
    
    const tokenBalance = await token.balanceOf(wallet.address);
    console.log("Token Balance:", ethers.formatEther(tokenBalance));
  } catch (e) {
    console.log("Mint failed:", e.message);
  }
  
  console.log("\n=== Test Complete ===");
  console.log("Token Address:", tokenAddress);
  console.log("View in Blockscout: http://localhost/address/" + tokenAddress);
}

main().catch(console.error);