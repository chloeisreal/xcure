/**
 * Deploy L3TokenBridge to xCure Network
 * Usage: npx hardhat run scripts/deployL3Bridge.ts --network xCureL3
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying L3TokenBridge...");
  console.log("Deployer:", deployer.address);

  const L2_BRIDGE = process.env.L2_TOKEN_BRIDGE || "0xF71C64F37A8AdA918b1fD7C7d9e3FC5aC6C813Ce";
  const CURE_TOKEN = process.env.CURE_TOKEN || "0x2c45C5b9C2bcBD8Ed93FF2f6b1B562C5619FC937";

  const L3TokenBridge = await ethers.getContractFactory("L3TokenBridge");
  const bridge = await L3TokenBridge.deploy(L2_BRIDGE, CURE_TOKEN, deployer.address);
  
  await bridge.waitForDeployment();
  const address = await bridge.getAddress();
  
  console.log("L3TokenBridge deployed to:", address);
  
  // Save deployment info
  const fs = require("fs");
  const deployment = {
    network: hre.network.name,
    chainId: (await ethers.provider.getNetwork()).chainId,
    address,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
  };
  
  fs.writeFileSync(
    "./deployments/l3-bridge.json",
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("Saved to deployments/l3-bridge.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });