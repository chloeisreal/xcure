/**
 * @deprecated This script is for the old enhanced bridge
 * Use scripts/deployL2Bridge.ts and scripts/deployL3Bridge.ts instead
 * 
 * This script requires specific artifacts and network setup
 */

const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("DEPRECATED: Use deployL2Bridge.ts and deployL3Bridge.ts instead");
  
  const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: Set PRIVATE_KEY or DEPLOYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("Deploying EnhancedL2Bridge to L2...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8547");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const fs = require("fs");
  
  try {
    const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/EnhancedBridge.sol/EnhancedL2Bridge.json", "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy();
    await contract.deploymentTransaction().wait();
    console.log("EnhancedL2Bridge deployed to:", contract.target);
  } catch (e) {
    console.log("Error: Artifact not found. Use new bridge deployment scripts.");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });