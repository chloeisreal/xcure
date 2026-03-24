const { ethers } = require("ethers");

const L2_BRIDGE = "0xac5bAd9b296B7F8D21B69a8A76aE0E7f619590e6";

async function main() {
  console.log("Deploying EnhancedL3Bridge to L3...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:3347");
  const wallet = new ethers.Wallet("0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e", provider);
  
  // Get fresh nonce
  const nonce = await provider.getTransactionCount(wallet.address);
  console.log("Current nonce:", nonce);
  
  const fs = require("fs");
  const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/EnhancedBridge.sol/EnhancedL3Bridge.json", "utf8"));
  
  const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
  const contract = await factory.deploy(L2_BRIDGE, { nonce });
  await contract.deploymentTransaction().wait();
  
  console.log("EnhancedL3Bridge deployed to:", contract.target);
  
  // Add supported token on L3 (MockCURE - same address on L2/L3 for test)
  const cureAddress = "0xf4d76f449E66c714105928f24bc9fD59692B1157";
  const tx = await contract.addSupportedToken(cureAddress, { nonce: nonce + 1 });
  await tx.wait();
  console.log("Added MockCURE as supported token");
  
  console.log("\n=== Deployment Summary ===");
  console.log("L2 Bridge: 0xac5bAd9b296B7F8D21B69a8A76aE0E7f619590e6");
  console.log("L3 Bridge:", contract.target);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
