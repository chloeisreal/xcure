const { ethers } = require("ethers");

const L3_RPC = "http://127.0.0.1:8449";
const PRIVATE_KEY = "0xe9d61d1a9f2d792a869072645f0cbf2f298a2e97bf37cdce8f1e00f29fcfa00e";

async function main() {
  const provider = new ethers.JsonRpcProvider(L3_RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log("=== xCure L3 Test ===");
  
  // Check balance after deploy
  const balance = await provider.getBalance(wallet.address);
  console.log("Remaining Balance:", ethers.formatEther(balance), "ETH");
  
  const blockNum = await provider.getBlockNumber();
  console.log("Current Block:", blockNum);
  
  // Get transaction receipt to find contract address
  const txHash = "0x413f4f5c32dc70f02d48192c4c1a75967414e9396de3e066d80912eb47686390";
  const receipt = await provider.getTransactionReceipt(txHash);
  
  if (receipt && receipt.contractAddress) {
    console.log("\n=== Contract Deployed! ===");
    console.log("Contract Address:", receipt.contractAddress);
    console.log("Transaction Hash:", txHash);
    console.log("Block Number:", receipt.blockNumber);
    console.log("Gas Used:", receipt.gasUsed);
    
    console.log("\n=== View in Blockscout ===");
    console.log("http://localhost/address/" + receipt.contractAddress);
  } else {
    console.log("No contract address found in receipt");
  }
  
  console.log("\n=== Test Complete ===");
}

main().catch(console.error);