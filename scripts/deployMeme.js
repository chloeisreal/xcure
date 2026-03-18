const hre = require("hardhat");
const { ethers } = require("hardhat");

const CURE_ADDRESS = "0xf4d76f449E66c714105928f24bc9fD59692B1157";

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n=== Meme Factory Deployment ===");
  console.log("Network :", hre.network.name);
  console.log("Deployer:", deployer.address);
  console.log("CURE    :", CURE_ADDRESS);

  // Deploy factory (deployer receives fees; cureToken = MockCURE on Arbitrum Sepolia)
  const MemeFactory = await ethers.getContractFactory("MemeFactory");
  const factory = await MemeFactory.deploy(deployer.address, CURE_ADDRESS);
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
  console.log("  creator :", parsed.args.creator);
  console.log("  name    :", parsed.args.name);
  console.log("  symbol  :", parsed.args.symbol);

  // Quick sanity check on the deployed token
  const MemeToken = await ethers.getContractFactory("MemeToken");
  const token = MemeToken.attach(tokenAddr);
  const totalSup = await token.totalSupply();
  const curveBal = await token.balanceOf(tokenAddr);
  const gradThresh = await token.GRAD_THRESHOLD();
  console.log("\n  totalSupply  :", ethers.formatEther(totalSup), "PEPE");
  console.log("  curve holds  :", ethers.formatEther(curveBal), "PEPE");
  console.log("  gradThreshold:", ethers.formatEther(gradThresh), "CURE");
  console.log("  cureToken    :", await token.cureToken());
  console.log("\n=== Done ===\n");
  console.log("Update FACTORY_ADDRESS in src/lib/meme-abis.ts to:", factoryAddr);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
