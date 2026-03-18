const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

const MOCK_BAO_ADDRESS = "0xcA8467C9a2d546B1A9Dc0AC8F668d2716D343730";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network = hre.network.name;
  const filename = network === "arbitrumSepolia" ? "arbitrum-sepolia.json" : "local.json";
  const outDir = path.join(__dirname, "../src/deployments");
  const outFile = path.join(outDir, filename);

  console.log("\n=== BAO-ETH Pool Deployment ===");
  console.log("Network:", network);
  console.log("Deployer:", deployer.address);
  console.log("MockBAO (existing):", MOCK_BAO_ADDRESS);

  // 1. Deploy MockWETH
  const MockWETH = await ethers.getContractFactory("MockWETH");
  const mockWETH = await MockWETH.deploy();
  await mockWETH.waitForDeployment();
  const wethAddress = await mockWETH.getAddress();
  console.log("\nMockWETH :", wethAddress);

  // 2. Deploy SimpleSwap(BAO, WETH)
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const simpleSwapBAOETH = await SimpleSwap.deploy(MOCK_BAO_ADDRESS, wethAddress);
  await simpleSwapBAOETH.waitForDeployment();
  const swapBAOETHAddress = await simpleSwapBAOETH.getAddress();
  console.log("SimpleSwapBAOWETH:", swapBAOETHAddress);

  // 3. Seed liquidity: 1000 BAO + 0.1 WETH
  const POOL_BAO  = ethers.parseEther("1000");
  const POOL_WETH = ethers.parseEther("0.1");

  const mockBAO = await ethers.getContractAt("MockERC20", MOCK_BAO_ADDRESS);
  await (await mockBAO.mint(deployer.address, POOL_BAO)).wait();
  await (await mockWETH.mint(deployer.address, POOL_WETH)).wait();

  await (await mockBAO.approve(swapBAOETHAddress, POOL_BAO)).wait();
  await (await mockWETH.approve(swapBAOETHAddress, POOL_WETH)).wait();
  await (await simpleSwapBAOETH.addLiquidity(POOL_BAO, POOL_WETH)).wait();
  console.log("\nPool seeded: 1 000 BAO / 0.1 WETH");

  // 4. Merge into existing deployment JSON
  fs.mkdirSync(outDir, { recursive: true });
  const existing = fs.existsSync(outFile) ? JSON.parse(fs.readFileSync(outFile, "utf8")) : {};
  const deployment = {
    ...existing,
    MockWETH: wethAddress,
    SimpleSwapBAOWETH: swapBAOETHAddress,
  };
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));

  console.log("\n✓ Saved to src/deployments/" + filename);
  console.log(JSON.stringify(deployment, null, 2));
  console.log("\n=== Done. ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
