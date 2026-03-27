const hre = require("hardhat");
const { ethers } = require("hardhat");
const fs   = require("fs");
const path = require("path");

const MOCK_WETH_ADDRESS = "0xd23ad7d69d892f2ccABFF2E78cb2e46751B49295";
const MOCK_CURE_ADDRESS = "0xf4d76f449E66c714105928f24bc9fD59692B1157";

async function main() {
  const [deployer] = await ethers.getSigners();
  const network  = hre.network.name;
  const filename = network === "arbitrumSepolia" ? "arbitrum-sepolia.json" : "local.json";
  const outDir   = path.join(__dirname, "../src/deployments");
  const outFile  = path.join(outDir, filename);

  console.log("\n=== WETH-CURE Pool Deployment ===");
  console.log("Network  :", network);
  console.log("Deployer :", deployer.address);
  console.log("MockWETH :", MOCK_WETH_ADDRESS);
  console.log("MockCURE :", MOCK_CURE_ADDRESS);

  // Check deployer ETH balance
  const balance = await deployer.provider.getBalance(deployer.address);
  console.log("ETH bal  :", ethers.formatEther(balance), "ETH");

  // 1. Deploy SimpleSwap(MockWETH, MockCURE)
  console.log("\nDeploying SimpleSwap(WETH, CURE)…");
  const SimpleSwap = await ethers.getContractFactory("SimpleSwap");
  const swap = await SimpleSwap.deploy(MOCK_WETH_ADDRESS, MOCK_CURE_ADDRESS);
  await swap.waitForDeployment();
  const swapAddress = await swap.getAddress();
  console.log("SimpleSwapWETHCURE:", swapAddress);

  // 2. Seed liquidity: 1 WETH + 1000 CURE
  const POOL_WETH = ethers.parseEther("1");
  const POOL_CURE = ethers.parseEther("1000");

  console.log("\nMinting seed tokens to deployer…");
  const mockWETH = await ethers.getContractAt("MockWETH",  MOCK_WETH_ADDRESS);
  const mockCURE = await ethers.getContractAt("MockERC20", MOCK_CURE_ADDRESS);

  await (await mockWETH.mint(deployer.address, POOL_WETH)).wait();
  console.log("  Minted 1 WETH");
  await (await mockCURE.mint(deployer.address, POOL_CURE)).wait();
  console.log("  Minted 1000 CURE");

  console.log("Approving…");
  await (await mockWETH.approve(swapAddress, POOL_WETH)).wait();
  await (await mockCURE.approve(swapAddress, POOL_CURE)).wait();

  console.log("Adding liquidity…");
  await (await swap.addLiquidity(POOL_WETH, POOL_CURE)).wait();
  console.log("Pool seeded: 1 WETH / 1000 CURE");

  // 3. Merge into existing deployment JSON
  fs.mkdirSync(outDir, { recursive: true });
  const existing = fs.existsSync(outFile)
    ? JSON.parse(fs.readFileSync(outFile, "utf8"))
    : {};
  const deployment = { ...existing, SimpleSwapWETHCURE: swapAddress };
  fs.writeFileSync(outFile, JSON.stringify(deployment, null, 2));

  console.log("\n✓ Saved to src/deployments/" + filename);
  console.log(JSON.stringify(deployment, null, 2));
  console.log("\n=== Done. ===\n");
  console.log("SimpleSwapWETHCURE:", swapAddress);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
