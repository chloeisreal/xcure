const { ethers } = require("hardhat");
const fs = require("fs");
const path = require("path");

async function main() {
  const [deployer, ...testWallets] = await ethers.getSigners();

  console.log("\n=== XCure Local Deployment ===");
  console.log("Deployer:", deployer.address);

  // ── 1. Deploy token contracts ────────────────────────────────────────────
  const MockERC20 = await ethers.getContractFactory("MockERC20");

  const mockCURE = await MockERC20.deploy("Mock CURE", "CURE", 18);
  await mockCURE.waitForDeployment();
  const cureAddress = await mockCURE.getAddress();
  console.log("\nMockCURE :", cureAddress);

  const mockBAO = await MockERC20.deploy("Mock BAO", "BAO", 18);
  await mockBAO.waitForDeployment();
  const baoAddress = await mockBAO.getAddress();
  console.log("MockBAO  :", baoAddress);

  // ── 2. Deploy AMM swap contract ─────────────────────────────────────────
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const simpleSwap = await SimpleSwap.deploy(cureAddress, baoAddress);
  await simpleSwap.waitForDeployment();
  const swapAddress = await simpleSwap.getAddress();
  console.log("SimpleSwap:", swapAddress);

  // ── 3. Seed the pool with liquidity ─────────────────────────────────────
  // Price: 1 CURE = 10 BAO
  const POOL_CURE = ethers.parseEther("1000000");   // 1 000 000 CURE
  const POOL_BAO  = ethers.parseEther("10000000");  // 10 000 000 BAO

  await mockCURE.mint(deployer.address, POOL_CURE * 2n);
  await mockBAO.mint(deployer.address, POOL_BAO * 2n);

  await (await mockCURE.approve(swapAddress, POOL_CURE)).wait();
  await (await mockBAO.approve(swapAddress, POOL_BAO)).wait();
  await (await simpleSwap.addLiquidity(POOL_CURE, POOL_BAO)).wait();

  console.log("\nPool seeded: 1 000 000 CURE / 10 000 000 BAO  (1 CURE ≈ 10 BAO)");

  // ── 4. Fund test wallets ─────────────────────────────────────────────────
  const TEST_CURE = ethers.parseEther("10000");   // 10 000 CURE per wallet
  const TEST_BAO  = ethers.parseEther("100000");  // 100 000 BAO per wallet

  console.log("\nFunding test wallets:");
  const walletsToFund = testWallets.slice(0, 5);
  for (const wallet of walletsToFund) {
    await mockCURE.mint(wallet.address, TEST_CURE);
    await mockBAO.mint(wallet.address, TEST_BAO);
    console.log(`  ${wallet.address}  +10 000 CURE  +100 000 BAO`);
  }

  // ── 5. Write addresses to frontend ──────────────────────────────────────
  const deployment = {
    MockCURE:   cureAddress,
    MockBAO:    baoAddress,
    SimpleSwap: swapAddress,
    chainId:    31337,
    deployedAt: new Date().toISOString(),
  };

  const outDir = path.join(__dirname, "../src/deployments");
  fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(
    path.join(outDir, "local.json"),
    JSON.stringify(deployment, null, 2)
  );

  console.log("\n✓ Saved to src/deployments/local.json");
  console.log(JSON.stringify(deployment, null, 2));
  console.log("\n=== Done. Restart `next dev` if it is already running. ===\n");
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
