"use client";

import { useState } from "react";
import { RainbowKitProvider, darkTheme, getDefaultConfig } from "@rainbow-me/rainbowkit";
import { WagmiProvider } from "wagmi";
import { arbitrumSepolia, type Chain } from "wagmi/chains";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import "@rainbow-me/rainbowkit/styles.css";

// xCure Network L3 - dev chain
const xCureL3: Chain = {
  id: 412346,
  name: "xCure Network",
  nativeCurrency: { name: "Ether", symbol: "ETH", decimals: 18 },
  rpcUrls: {
    default: { http: ["http://127.0.0.1:8449"] },
  },
  testnet: true,
};

const config = getDefaultConfig({
  appName: "XCure",
  projectId: process.env.NEXT_PUBLIC_WALLETCONNECT_PROJECT_ID || "xcure-placeholder",
  chains: [xCureL3, arbitrumSepolia],
  ssr: true,
});

export function Providers({ children }: { children: React.ReactNode }) {
  const [queryClient] = useState(() => new QueryClient());

  return (
    <WagmiProvider config={config}>
      <QueryClientProvider client={queryClient}>
        <RainbowKitProvider theme={darkTheme({
          accentColor: "#3b82f6",
          accentColorForeground: "white",
          borderRadius: "medium",
        })}>
          {children}
        </RainbowKitProvider>
      </QueryClientProvider>
    </WagmiProvider>
  );
}
