/**
 * @deprecated Use l3-poc/contracts/scripts/deployL2Bridge.ts instead
 */

const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("DEPRECATED: Use l3-poc/contracts/scripts/deployL2Bridge.ts");
  
  const privateKey = process.env.PRIVATE_KEY || process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: Set PRIVATE_KEY or DEPLOYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("Deploying L2Bridge to L2 (Sequencer)...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8547");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Deployer:", wallet.address);
  
  const fs = require("fs");
  
  try {
    const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/SimpleBridge.sol/L2Bridge.json", "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const l2Bridge = await factory.deploy();
    console.log("L2Bridge deployed to:", l2Bridge.target);
  } catch (e) {
    console.log("Error: Artifact not found");
  }
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });