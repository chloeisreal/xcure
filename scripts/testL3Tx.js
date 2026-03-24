const { ethers } = require("ethers");

async function main() {
  console.log("Testing simple transfer on L3...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:3347");
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e", provider);
  
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
