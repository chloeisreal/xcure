const hre = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const networkName = hre.network.name;
  console.log(`🚀 Deploying Cure Token to ${networkName}...\n`);

  const [deployer] = await hre.ethers.getSigners();
  console.log(`📝 Deployer address: ${deployer.address}`);
  const balance = await hre.ethers.provider.getBalance(deployer.address);
  console.log(`   Balance: ${hre.ethers.formatEther(balance)} ETH\n`);

  const CureToken = await hre.ethers.getContractFactory("CureToken");
  const cureToken = await CureToken.deploy();
  
  await cureToken.waitForDeployment();
  const tokenAddress = await cureToken.getAddress();
  
  console.log(`✅ CureToken deployed at: ${tokenAddress}`);
  const totalSupply = await cureToken.totalSupply();
  console.log(`   Total Supply: ${hre.ethers.formatEther(totalSupply)} CURE\na`);

  const chainId = networkName === "arbitrumSepolia" ? 421614 
    : networkName === "local" ? 412346
    : networkName === "localL3" ? 333333
    : 0;

  const deploymentInfo = {
    network: networkName,
    chainId,
    tokenAddress,
    deployer: deployer.address,
    timestamp: new Date().toISOString(),
    explorer: networkName === "arbitrumSepolia" ? "https://sepolia.arbiscan.io" : "http://localhost:4000",
  };

  const deploymentsDir = path.join(__dirname, "..", "..", "deployments");
  if (!fs.existsSync(deploymentsDir)) {
    fs.mkdirSync(deploymentsDir, { recursive: true });
  }

  const filename = `cure-${networkName}.json`;
  fs.writeFileSync(
    path.join(deploymentsDir, filename),
    JSON.stringify(deploymentInfo, null, 2)
  );

  console.log(`📄 Deployment info saved to: ${path.join(deploymentsDir, filename)}`);
  console.log(`\n🔗 View on Explorer: ${deploymentInfo.explorer}/address/${tokenAddress}`);
  
  console.log(`\n🎯 NEXT STEPS:`);
  console.log(`1. Run L3: cd ../nitro-testnode && ./test-node.bash --init --l3node --l3-fee-token`);
  console.log(`2. Add L3 to MetaMask: http://127.0.0.1:3347 (Chain ID: 333333)`);
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error("❌ Deployment failed:", error);
    process.exit(1);
  });
