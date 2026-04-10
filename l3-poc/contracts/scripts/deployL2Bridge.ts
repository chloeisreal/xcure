/**
 * Deploy L2TokenBridge to Arbitrum Sepolia
 * Usage: npx hardhat run scripts/deployL2Bridge.ts --network arbitrumSepolia
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying L2TokenBridge to Arbitrum Sepolia...");
  console.log("Deployer:", deployer.address);

  const L3_BRIDGE = process.env.L3_TOKEN_BRIDGE || "0x3B298e17897548aEB02F52e6761ec578D195A21b";
  const MOCK_CURE = process.env.MOCK_CURE || "0xf4d76f449E66c714105928f24bc9fD59692B1157";

  const L2TokenBridge = await ethers.getContractFactory("L2TokenBridge");
  const bridge = await L2TokenBridge.deploy(L3_BRIDGE, MOCK_CURE, deployer.address);
  
  await bridge.waitForDeployment();
  const address = await bridge.getAddress();
  
  console.log("L2TokenBridge deployed to:", address);
  
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
    "./deployments/l2-bridge.json",
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("Saved to deployments/l2-bridge.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });