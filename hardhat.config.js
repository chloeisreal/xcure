require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const arbitrumSepoliaUrl = process.env.ARBITRUM_SEPOLIA_RPC;
const privateKey = process.env.PRIVATE_KEY;
const l3RpcUrl = process.env.L3_RPC || "http://127.0.0.1:8449";
const l3PrivateKey = process.env.DEPLOYER_PRIVATE_KEY;

module.exports = {
  solidity: "0.8.20",
  networks: {
    hardhat: {},
    ...(arbitrumSepoliaUrl && privateKey ? {
      arbitrumSepolia: {
        url: arbitrumSepoliaUrl,
        accounts: [privateKey],
      },
    } : {}),
    ...(l3RpcUrl && l3PrivateKey ? {
      xCureL3: {
        url: l3RpcUrl,
        accounts: [l3PrivateKey],
        chainId: 412346,
      },
    } : {}),
  },
};