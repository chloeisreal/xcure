require("@nomicfoundation/hardhat-toolbox");
require("dotenv").config();

const arbitrumSepoliaUrl = process.env.ARBITRUM_SEPOLIA_RPC;
const privateKey = process.env.PRIVATE_KEY;

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
    l3: {
      url: "http://127.0.0.1:3347",
      accounts: ["0xecdf21cb41c65afb51f91df408b7656e2c8739a5877f2814add0afd780cc210e"],
    },
  },
};
