const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, ...testWallets] = await ethers.getSigners();
  const network = hre.network.name;
  const chainId = network === "arbitrumSepolia" ? 421614 : 31337;
  const filename = network === "arbitrumSepolia" ? "arbitrum-sepolia.json" : "local.json";

  console.log("\n=== XCure Deployment ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);

  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const mockCURE = await MockERC20.deploy("Mock CURE", "CURE", 18);
  await mockCURE.waitForDeployment();
  const cureAddress = await mockCURE.getAddress();
  console.log("\nMockCURE :", cureAddress);

  const mockBAO = await MockERC20.deploy("Mock BAO", "BAO", 18);
  await mockBAO.waitForDeployment();
  const baoAddress = await mockBAO.getAddress();
  console.log("MockBAO  :", baoAddress);

  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy(cureAddress, baoAddress);
  await simpleSwap.waitForDeployment();
  const swapAddress = await simpleSwap.getAddress();
  console.log("SimpleSwap:", swapAddress);

  const POOL_CURE = ethers.parseEther("1000000");
  const POOL_BAO  = ethers.parseEther("10000000");

  await mockCURE.mint(deployer.address, POOL_CURE * 2n);
  await mockBAO.mint(deployer.address, POOL_BAO * 2n);

  await (await mockCURE.approve(swapAddress, POOL_CURE)).wait();
  await (await mockBAO.approve(swapAddress, POOL_BAO)).wait();
  await (await simpleSwap.addLiquidity(POOL_CURE, POOL_BAO)).wait();

  console.log("\nPool seeded: 1 000 000 CURE / 10 000 000 BAO");

  const deployment = {
    MockCURE:   cureAddress,
    MockBAO:    baoAddress,
    SimpleSwap: swapAddress,
    chainId:    chainId,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "../src/deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, filename),
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n✓ Saved to src/deployments/" + filename);
  console.log(JSON.stringify(deployment, null, 2));
  console.log("\n=== Done. Restart `next dev` if it is already running. ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
