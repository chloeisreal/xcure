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

  console.log("Deploying L3Bridge to L3...");
  
  const provider = new ethers.JsonRpcProvider("http://127.0.0.1:8449");
  const wallet = new ethers.Wallet(privateKey, provider);
  
  console.log("Deployer:", wallet.address);
  
  const fs = require("fs");
  
  try {
    const artifact = JSON.parse(fs.readFileSync("./artifacts/contracts/SimpleBridge.sol/L3Bridge.json", "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, wallet);
    const contract = await factory.deploy("0x0000000000000000000000000000000000000000");
    console.log("L3Bridge deployed to:", contract.target);
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