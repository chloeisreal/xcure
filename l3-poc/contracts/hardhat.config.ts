import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import "dotenv/config";

const config: HardhatUserConfig = {
  solidity: {
    version: "0.8.20",
    settings: {
      optimizer: {
        enabled: true,
        runs: 200,
      },
    },
  },

  networks: {
    local: {
      url: "http://127.0.0.1:8547",
      chainId: 412346,
      accounts: [
        "0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659",
      ],
    },

    localL3: {
      url: "http://127.0.0.1:3347",
      chainId: 333333,
      accounts: [
        "0xb6b15c8cb491557369f3c7d2c287b053eb229daa9c22138887752191c9520659",
      ],
    },

    arbitrumSepolia: {
      url: process.env.ARBITRUM_SEPOLIA_RPC || "https://arb-sepolia.g.alchemy.com/v2/demo",
      chainId: 421614,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },

    arbitrum: {
      url: process.env.ARBITRUM_RPC || "https://arb1.arbitrum.io/rpc",
      chainId: 42161,
      accounts: process.env.DEPLOYER_PRIVATE_KEY
        ? [process.env.DEPLOYER_PRIVATE_KEY]
        : [],
    },
  },

  etherscan: {
    apiKey: {
      arbitrumOne: process.env.ARBISCAN_API_KEY || "",
      arbitrumSepolia: process.env.ARBISCAN_API_KEY || "",
    },
  },
};

export default config;
