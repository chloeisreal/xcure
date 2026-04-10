/**
 * @deprecated Use l3-poc/contracts/scripts/deployL3Bridge.ts instead
 */

const { ethers } = require("ethers");
require("dotenv").config();

async function main() {
  console.log("DEPRECATED: Use l3-poc/contracts/scripts/deployL3Bridge.ts");
  
  const privateKey = process.env.DEPLOYER_PRIVATE_KEY;
  if (!privateKey) {
    console.error("Error: Set DEPLOYER_PRIVATE_KEY in .env");
    process.exit(1);
  }

  console.log("Deploying EnhancedL3Bridge to L3...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8449");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  const fs = require("fs");
  
  try {
    const L2_BRIDGE = "0xF71C64F37A8AdA918b1fD7C7d9e3FC5aC6C813Ce";
    const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/EnhancedBridge.sol/EnhancedL3Bridge.json", "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy(L2_BRIDGE);
    console.log("EnhancedL3Bridge deployed to:", contract.target);
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