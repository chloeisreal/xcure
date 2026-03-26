"use client";

import { useState, useEffect } from "react";
import { useReadContract, useReadContracts } from "wagmi";
import { FACTORY_ADDRESS, FACTORY_ABI, MEME_TOKEN_ABI } from "@/lib/meme-abis";

const SWAP_CONTRACTS = [
  "0xDF0FB1782e6388845d78B318ee7460778342C7FA",
  "0x3f4C141153B1994bcb72D22d37a8073f58981Ad6",
] as const;

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return n.toString();
}

export default function StatsBar() {
  const [totalSwaps, setTotalSwaps] = useState<number | null>(null);

  useEffect(() => {
    async function fetchSwapCounts() {
      try {
        const counts = await Promise.all(
          SWAP_CONTRACTS.map(async (addr) => {
            const url =
              `https://api-sepolia.arbiscan.io/api?module=account&action=txlist` +
              `&address=${addr}&startblock=0&endblock=99999999&sort=asc`;
            const res  = await fetch(url);
            const json = await res.json();
            return Array.isArray(json.result) ? json.result.length : 0;
          }),
        );
        setTotalSwaps(counts.reduce((a, b) => a + b, 0));
      } catch {
        setTotalSwaps(0);
      }
    }
    fetchSwapCounts();
  }, []);

  const { data: length } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "allTokensLength",
  });

  const { data: tokenAddresses } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getTokens",
    args: [0n, length ?? 0n],
    query: { enabled: length != null && length > 0n },
  });

  const contracts = (tokenAddresses ?? []).map((addr) => ({
    address: addr as `0x${string}`,
    abi: MEME_TOKEN_ABI,
    functionName: "cureRaised" as const,
  }));

  const { data: cureRaisedResults } = useReadContracts({
    contracts,
    query: { enabled: contracts.length > 0 },
  });

  const tokenCount = length != null ? Number(length) : null;

  const totalCure =
    cureRaisedResults != null
      ? cureRaisedResults
          .filter((r) => r.status === "success")
          .reduce((sum, r) => sum + (r.result as bigint), 0n)
      : null;
  const cureRaisedNum =
    totalCure != null ? Number(totalCure / 10n ** 18n) : null;

  const stats = [
    {
      label: "Tokens Launched",
      value: tokenCount != null ? `${tokenCount}` : "...",
    },
    {
      label: "CURE Raised",
      value: cureRaisedNum != null ? `${fmt(cureRaisedNum)} CURE` : "...",
    },
    { label: "Trading Pairs",  value: "2" },
    { label: "Total Swaps",    value: totalSwaps != null ? fmt(totalSwaps) : "..." },
    { label: "VC Allocation",  value: "0%" },
  ];

  return (
    <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm px-6 py-4 grid grid-cols-2 sm:grid-cols-5 gap-y-4 gap-x-2 text-center">
      {stats.map((s) => (
        <div key={s.label} className="flex flex-col gap-0.5">
          <span className="text-white font-bold text-sm sm:text-base">{s.value}</span>
          <span className="text-slate-500 text-xs">{s.label}</span>
        </div>
      ))}
    </div>
  );
}
