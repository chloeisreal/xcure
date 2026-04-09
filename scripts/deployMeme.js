const hre = require("hardhat");
const { ethers } = require("hardhat");

const CURE_ADDRESS          = "0xf4d76f449E66c714105928f24bc9fD59692B1157";
const UNISWAP_V2_ROUTER     = "0x4752ba5DBc23f44D87826276BF6Fd6b1C372aD24"; // Arbitrum Sepolia & One

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n=== Meme Factory Deployment ===");
  console.log("Network         :", hre.network.name);
  console.log("Deployer        :", deployer.address);
  console.log("CURE            :", CURE_ADDRESS);
  console.log("Uniswap V2 Router:", UNISWAP_V2_ROUTER);

  // Deploy factory
  const MemeFactory = await ethers.getContractFactory("MemeFactory");
  const factory = await MemeFactory.deploy(
    deployer.address,    // feeRecipient
    CURE_ADDRESS,        // cureToken
    UNISWAP_V2_ROUTER    // uniswapV2Router
  );
  await factory.waitForDeployment();
  const factoryAddr = await factory.getAddress();
  console.log("\nMemeFactory:", factoryAddr);

  // Create a sample token to verify the factory works
  const tx = await factory.createToken("PepeCure", "PEPE");
  const receipt = await tx.wait();

  const iface = factory.interface;
  const log   = receipt.logs.find(l => {
    try { return iface.parseLog(l)?.name === "TokenCreated"; }
    catch { return false; }
  });
  const parsed    = iface.parseLog(log);
  const tokenAddr = parsed.args.token;

  console.log("\nSample MemeToken:", tokenAddr);
  console.log("  creator       :", parsed.args.creator);
  console.log("  name          :", parsed.args.name);
  console.log("  symbol        :", parsed.args.symbol);

  // Sanity check on the deployed token
  const MemeToken = await ethers.getContractAt("MemeToken", tokenAddr);
  const totalSup   = await MemeToken.totalSupply();
  const curveBal   = await MemeToken.balanceOf(tokenAddr);
  const gradThresh = await MemeToken.GRAD_THRESHOLD();
  const router     = await MemeToken.uniswapV2Router();
  console.log("\n  totalSupply    :", ethers.formatEther(totalSup), "PEPE");
  console.log("  curve holds    :", ethers.formatEther(curveBal), "PEPE");
  console.log("  gradThreshold  :", ethers.formatEther(gradThresh), "CURE");
  console.log("  cureToken      :", await MemeToken.cureToken());
  console.log("  uniswapV2Router:", router);

  console.log("\n=== Done ===\n");
  console.log("⚠️  Update FACTORY_ADDRESS in src/lib/meme-abis.ts to:", factoryAddr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
