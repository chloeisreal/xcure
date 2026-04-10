const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: Set DEPLOYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("Testing simple transfer on L3...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8449");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  // Send 0.01 ETH to itself (test transaction)
  const tx = {
    to: wallet.address,
    value: ethers.parseEther("0.01")
  };
  
  console.log("Sending transaction...");
  const result = await wallet.sendTransaction(tx);
  console.log("TX hash:", result.hash);
  await result.wait();
  console.log("Transaction confirmed!");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });