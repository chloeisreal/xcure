import { type Chain } from "wagmi/chains";
import { http, createConfig } from "wagmi";
import { injected } from "wagmi/connectors";

/**
 * Cure L3 Chain Configuration for Wagmi
 * 
 * This config enables the frontend to:
 * 1. Add "Switch to Cure L3 (local)" button
 * 2. Display balance in CURE token
 * 3. Show gas fees paid in CURE
 */

export const cureL3 = {
  id: 169887786,
  name: "xCure Network",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8449"],
    },
    public: {
      http: ["http://127.0.0.1:8449"],
    },
  },
  blockExplorers: {
    default: {
      name: "xCure Explorer",
      url: "http://localhost:4000",
    },
  },
  testnet: true,
} as const satisfies Chain;

/**
 * Optional: L2 (Arbitrum Nitro) for bridging
 */
export const arbitrumNitro = {
  id: 412346,
  name: "Arbitrum Nitro (Local)",
  nativeCurrency: {
    name: "Ether",
    symbol: "ETH",
    decimals: 18,
  },
  rpcUrls: {
    default: {
      http: ["http://127.0.0.1:8547"],
    },
    public: {
      http: ["http://127.0.0.1:8547"],
    },
  },
  testnet: true,
} as const satisfies Chain;

/**
 * Wagmi Config - Add to your existing wagmi config
 * 
 * Usage in your existing providers.tsx:
 * 
 * import { cureL3 } from './wagmi-config/chains';
 * 
 * const config = createConfig({
 *   chains: [mainnet, arbitrum, cureL3],
 *   connectors: [injected()],
 *   transports: {
 *     [mainnet.id]: http(),
 *     [arbitrum.id]: http(),
 *     [cureL3.id]: http('http://127.0.0.1:3347'),
 *   },
 * })
 */
export const wagmiConfig = createConfig({
  chains: [cureL3],
  connectors: [injected()],
  transports: {
    [cureL3.id]: http("http://127.0.0.1:8449"),
  },
});

/**
 * Helper function to switch to Cure L3
 * Use with useSwitchChain hook
 */
export const switchToCureL3 = {
  chainId: cureL3.id,
};

/**
 * Chain list for dropdown selection
 */
export const supportedChains = [cureL3];

/**
 * Demo account for testing
 * WARNING: Never use in production!
 */
export const demoAccount = {
  address: process.env.DEMO_ACCOUNT_ADDRESS as `0x${string}` || "0x0000000000000000000000000000000000000000",
  privateKey: process.env.DEMO_PRIVATE_KEY as `0x${string}` || "" as `0x${string}`,
};
