require("dotenv").config();
const { ethers } = require("ethers");

require("dotenv").config();
const RPC = process.env.ARBITRUM_SEPOLIA_RPC;
const PRIVATE_KEY = process.env.DEPLOYER_PRIVATE_KEY;
const ROLLUP_CREATOR = "0x0F7f71c48c6278422736a4a9441cd1d59ba0C2dB";
const CHAIN_ID = 281003;

async function main() {
  const provider = new ethers.JsonRpcProvider(RPC);
  const wallet = new ethers.Wallet(PRIVATE_KEY, provider);
  
  console.log("=== Deploy Rollup to Arbitrum Sepolia ===");
  console.log("Deployer:", wallet.address);
  
  const balance = await provider.getBalance(wallet.address);
  console.log("Balance:", ethers.formatEther(balance), "ETH");
  
  if (balance < ethers.parseEther("0.05")) {
    console.log("❌ Need more ETH. Get from faucet first.");
    return;
  }
  
  // RollupCreator 完整接口
  const abi = [
    "function createRollup((bytes32,address,address,uint256,address,uint64,uint256,bytes32,uint256,bytes32,bytes32,address[],bool,address,uint256,address[],bool)) returns (address)"
  ];
  
  const contract = new ethers.Contract(ROLLUP_CREATOR, abi, wallet);
  
  // 构建 RollupConfig 结构
  // 这是一个复杂的嵌套结构
  const config = {
    // bytes32 chainId
    chainId: ethers.zeroPadValue(ethers.toBeHex(CHAIN_ID), 32),
    // address owner
    owner: wallet.address,
    // address stakeToken (0 = ETH)
    stakeToken: ethers.ZeroAddress,
    // uint256 confirmPeriodBlocks
    confirmPeriodBlocks: 150,
    // address rewardAggregator
    rewardAggregator: ethers.ZeroAddress,
    // uint64 extraChallengeTimeBlocks
    extraChallengeTimeBlocks: 100,
    // bytes32 sequencerInboxMaxTimeVariation (encoded)
    sequencerInboxMaxTimeVariation: ethers.zeroPadValue("0x", 32),
    // uint256 baseStake
    baseStake: ethers.parseEther("0.01"),
    // bytes32 validatorThesis
    validatorThesis: ethers.ZeroHash,
    // uint256 maxValidatorCount
    maxValidatorCount: 10,
    // bytes32 chainConfig
    chainConfig: "0x",
    // address[] batchPosters
    batchPosters: [wallet.address],
    // bool deployFactoriesToL2
    deployFactoriesToL2: true,
    // address nativeToken (0 = ETH)
    nativeToken: ethers.ZeroAddress,
    // uint256 maxFeePerGasForRetryables
    maxFeePerGasForRetryables: 0,
    // address[] validators
    validators: [wallet.address],
    // bool isCustomFeeToken
    isCustomFeeToken: false
  };
  
  console.log("\n⚠️ Note: The config structure needs proper encoding.");
  console.log("Recommended: Use https://orbit.arbitrum.io/");
  console.log("Or RaaS: https://caldera.xyz/");
}

main().catch(console.error);