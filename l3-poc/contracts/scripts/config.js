/**
 * xCure L3 Deployment Scripts
 * 
 * Usage: node scripts/<script-name>.js
 * 
 * Required environment variables (from .env):
 *   - DEPLOYER_PRIVATE_KEY: Wallet private key
 *   - L3_RPC: L3 RPC URL (default: http://127.0.0.1:8449)
 *   - ARBITRUM_SEPOLIA_RPC: L2 RPC URL
 */

const { ethers } = require("ethers");
require("dotenv").config({ path: "./.env" });

const L3_RPC = process.env.L3_RPC || "http://127.0.0.1:8449";
const ARB_SEPOLIA_RPC = process.env.ARBITRUM_SEPOLIA_RPC;

const CHAIN_CONFIG = {
  l2: {
    tokenBridge: "0xF71C64F37A8AdA918b1fD7C7d9e3FC5aC6C813Ce",
    cureToken: "0xf4d76f449E66c714105928f24bc9fD59692B1157",
  },
  l3: {
    tokenBridge: "0x3B298e17897548aEB02F52e6761ec578D195A21b",
    cureToken: "0x2c45C5b9C2bcBD8Ed93FF2f6b1B562C5619FC937",
  },
};

module.exports = { L3_RPC, ARB_SEPOLIA_RPC, CHAIN_CONFIG };