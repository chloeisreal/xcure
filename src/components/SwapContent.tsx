"use client";

import { useChainId } from "wagmi";
import SwapWidget from "@/components/SwapWidget";
import LocalSwapWidget from "@/components/LocalSwapWidget";

const HARDHAT_CHAIN_ID = 31337;

/**
 * Renders the correct swap widget based on the connected chain:
 * - Chain 31337 (Hardhat local) → LocalSwapWidget (direct AMM contract calls)
 * - Any other chain              → SwapWidget (0x Protocol API)
 */
export default function SwapContent() {
  const chainId = useChainId();
  return chainId === HARDHAT_CHAIN_ID ? <LocalSwapWidget /> : <SwapWidget />;
}
