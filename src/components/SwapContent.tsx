"use client";

import { useChainId } from "wagmi";
import SwapWidget from "@/components/SwapWidget";
import LocalSwapWidget from "@/components/LocalSwapWidget";

const HARDHAT_CHAIN_ID = 31337;
const ARBITRUM_SEPOLIA_CHAIN_ID = 421614;

export default function SwapContent() {
  const chainId = useChainId();
  const useLocalSwap = chainId === HARDHAT_CHAIN_ID || chainId === ARBITRUM_SEPOLIA_CHAIN_ID;
  return useLocalSwap ? <LocalSwapWidget /> : <SwapWidget />;
}
