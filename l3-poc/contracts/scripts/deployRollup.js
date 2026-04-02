require("dotenv").config();
const hre = require("hardhat");
const { ethers } = require("ethers");

const CHAIN_ID = 281003n;
const PARENT_CHAIN_RPC = "https://arb-sepolia.g.alchemy.com/v2/zx7BMikiG5OzteHcbrIPW";
const DEPLOYER_KEY = "0xe9d61d1a9f2d792a869072645f0cbf2f298a2e97bf37cdce8f1e00f29fcfa00e";
const ROLLUP_CREATOR = "0x0F7f71c48c6278422736a4a9441cd1d59ba0C2dB";

async function main() {
  const provider = new ethers.JsonRpcProvider(PARENT_CHAIN_RPC);
  const wallet = new ethers.Wallet(DEPLOYER_KEY, provider);
  
  console.log("Deployer:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  // RollupCreator ABI
  const abi = [
    "function createRollup((bytes32,address,address,uint256,address,uint64,uint256,bytes32,uint256,bytes32,bytes32,address[],bool,address,uint256,address[],bool)) returns (address)",
    "function rollupTypeAndVersion() view returns (string)",
    "function owner() view returns (address)"
  ];
  
  const contract = new ethers.Contract(ROLLUP_CREATOR, abi, wallet);
  
  try {
    const version = await contract.rollupTypeAndVersion();
    console.log("RollupCreator version:", version);
  } catch (e) {
    console.log("Version check failed:", e.reason || e.message);
  }
  
  const owner = await contract.owner();
  console.log("RollupCreator owner:", owner);
  
  console.log("\n--- Preparing Rollup Config ---");
  
  // Simplified config - full deployment needs more params
  const rollupConfig = {
    chainId: ethers.zeroPadValue(ethers.toBeHex(CHAIN_ID), 32),
    confirmPeriodBlocks: 150,
    extraChallengeTimeBlocks: 100,
    stakeToken: ethers.ZeroAddress,
    rewardAggregator: ethers.ZeroAddress,
    sequencerInboxMaxTimeVariation: {
      delayBlocks: 86400,
      delaySeconds: 604800,
      futureBlocks: 48,
      futureSeconds: 28800,
      multiplierPrecision: ethers.parseEther("1")
    },
    baseStake: ethers.parseEther("0.001"),
    minAssertPeriod: 1250,
    maxValidatorCount: 10,
    validatorThesis: ethers.ZeroHash,
    emissionRate: 0,
    initialInvalidHeaderHash: ethers.ZeroHash,
    initialInboxSizeLimit: 104857,
    maxDataSize: 104857,
    nativeToken: ethers.ZeroAddress,
    deployFactoriesToL2: true,
    maxFeePerGasForRetryables: 0,
    batchPosters: [wallet.address],
    validators: [wallet.address],
    admin: wallet.address,
    chainConfig: "0x",
    upgradeExecutor: ethers.ZeroAddress
  };
  
  console.log("Config prepared.");
  console.log("Note: Full deployment via SDK is recommended.");
}

main()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });