const { ethers } = require("hardhat");

async function main() {
  const [deployer] = await ethers.getSigners();
  console.log("\n=== Meme Factory Deployment ===");
  console.log("Network :", hre.network.name);
  console.log("Deployer:", deployer.address);

  // Deploy factory (deployer receives fees in this script)
  const MemeFactory = await ethers.getContractFactory("MemeFactory");
  const factory = await MemeFactory.deploy(deployer.address);
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
  const parsed   = iface.parseLog(log);
  const tokenAddr = parsed.args.token;

  console.log("Sample MemeToken:", tokenAddr);
  console.log("  creator :", parsed.args.creator);
  console.log("  name    :", parsed.args.name);
  console.log("  symbol  :", parsed.args.symbol);

  // Quick sanity check on the deployed token
  const MemeToken = await ethers.getContractFactory("MemeToken");
  const token = MemeToken.attach(tokenAddr);
  const totalSup = await token.totalSupply();
  const curvebal = await token.balanceOf(tokenAddr);
  console.log("\n  totalSupply :", ethers.formatEther(totalSup), "PEPE");
  console.log("  curve holds :", ethers.formatEther(curvebal), "PEPE");
  console.log("  grad thresh :", ethers.formatEther(await token.GRAD_THRESHOLD()), "ETH");
  console.log("\n=== Done ===\n");
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
