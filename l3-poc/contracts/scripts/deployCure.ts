/**
 * Deploy CureToken to xCure Network
 * Usage: npx hardhat run scripts/deployCure.ts --network xCureL3
 */

const hre = require("hardhat");
const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  
  console.log("Deploying CureToken...");
  console.log("Deployer:", deployer.address);

  const CureToken = await ethers.getContractFactory("CureToken");
  const token = await CureToken.deploy();
  
  await token.waitForDeployment();
  const address = await token.getAddress();
  
  console.log("CureToken deployed to:", address);
  
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
    "./deployments/cure-token.json",
    JSON.stringify(deployment, null, 2)
  );
  
  console.log("Saved to deployments/cure-token.json");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });