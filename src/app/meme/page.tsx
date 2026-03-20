"use client";

import { useState, useMemo } from "react";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract, useReadContracts } from "wagmi";
import { formatUnits } from "viem";
import { FACTORY_ADDRESS, FACTORY_ABI, MEME_TOKEN_ABI, GRAD_THRESHOLD } from "@/lib/meme-abis";

const COLORS = ["#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706", "#db2777", "#0891b2", "#7c2d12"];

type SortOption = "hottest" | "newest" | "graduating" | "graduated";

const SORT_LABELS: Record<SortOption, string> = {
  hottest:    "🔥 Hottest",
  newest:     "🆕 Newest",
  graduating: "🎯 Graduating Soon",
  graduated:  "🎓 Graduated",
};

export default function MemePage() {
  const [search, setSearch] = useState("");
  const [sort, setSort]     = useState<SortOption>("hottest");

  const { data: length } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "allTokensLength",
    query: { refetchInterval: 10_000 },
  });

  const { data: addresses } = useReadContract({
    address: FACTORY_ADDRESS,
    abi: FACTORY_ABI,
    functionName: "getTokens",
    args: [0n, length ?? 0n],
    query: { enabled: !!length && length > 0n, refetchInterval: 10_000 },
  });

  const tokenAddrs = (addresses ?? []) as readonly `0x${string}`[];

  const { data: tokenData } = useReadContracts({
    contracts: tokenAddrs.flatMap((addr) => [
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "name"       } as const,
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "symbol"     } as const,
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "cureRaised" } as const,
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "graduated"  } as const,
    ]),
    query: { enabled: tokenAddrs.length > 0, refetchInterval: 10_000 },
  });

  const tokens = tokenAddrs.map((addr, i) => ({
    address:     addr,
    originalIdx: i,
    name:        (tokenData?.[i * 4    ]?.result ?? "…")   as string,
    symbol:      (tokenData?.[i * 4 + 1]?.result ?? "…")   as string,
    cureRaised:  (tokenData?.[i * 4 + 2]?.result ?? 0n)    as bigint,
    graduated:   (tokenData?.[i * 4 + 3]?.result ?? false) as boolean,
  }));

  // ── Aggregate stats ───────────────────────────────────────────────────────
  const graduatedCount  = tokens.filter((t) => t.graduated).length;
  const totalCureRaised = tokens.reduce((acc, t) => acc + t.cureRaised, 0n);

  // ── Filter + sort (client-side) ───────────────────────────────────────────
  const displayed = useMemo(() => {
    const q = search.trim().toLowerCase();
    const filtered = q
      ? tokens.filter(
          (t) =>
            t.name.toLowerCase().includes(q) ||
            t.symbol.toLowerCase().includes(q),
        )
      : tokens;

    return [...filtered].sort((a, b) => {
      switch (sort) {
        case "hottest":
          return a.cureRaised > b.cureRaised ? -1 : a.cureRaised < b.cureRaised ? 1 : 0;
        case "newest":
          return b.originalIdx - a.originalIdx;
        case "graduating":
          // Non-graduated first (closest to threshold), then graduated
          if (a.graduated !== b.graduated) return a.graduated ? 1 : -1;
          return a.cureRaised > b.cureRaised ? -1 : a.cureRaised < b.cureRaised ? 1 : 0;
        case "graduated":
          if (a.graduated !== b.graduated) return a.graduated ? -1 : 1;
          return a.cureRaised > b.cureRaised ? -1 : a.cureRaised < b.cureRaised ? 1 : 0;
      }
    });
  }, [tokens, search, sort]);

  return (
    <div className="min-h-screen bg-[#111827] text-white p-6">
      <div className="max-w-5xl mx-auto">

        {/* Header */}
        <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
          <div>
            <h1 className="text-2xl font-bold">🚀 Meme Launch</h1>
            <p className="text-slate-400 text-sm mt-1">
              Bonding curve token launcher · Arbitrum Sepolia
            </p>
          </div>
          <div className="flex items-center gap-3">
            <ConnectButton />
            <Link
              href="/meme/create"
              className="px-4 py-2 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-colors whitespace-nowrap"
            >
              + Create Token
            </Link>
          </div>
        </div>

        {/* Stats bar */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-5 py-3 flex flex-wrap gap-x-6 gap-y-2 text-sm mb-4">
          <span className="text-slate-400">
            Tokens launched:{" "}
            <span className="text-white font-semibold">{Number(length ?? 0n)}</span>
          </span>
          <span className="text-slate-400">
            Graduated:{" "}
            <span className="text-green-400 font-semibold">{graduatedCount}</span>
          </span>
          <span className="text-slate-400">
            Total CURE raised:{" "}
            <span className="text-purple-300 font-semibold">
              {parseFloat(formatUnits(totalCureRaised, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} CURE
            </span>
          </span>
          <span className="text-slate-400">
            Factory:{" "}
            <span className="font-mono text-xs text-slate-300">{FACTORY_ADDRESS.slice(0, 10)}…</span>
          </span>
        </div>

        {/* Search + Sort */}
        {tokens.length > 0 && (
          <div className="flex gap-2 mb-6">
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Search by name or symbol…"
              className="flex-1 rounded-xl border border-slate-700 bg-slate-800/80 px-4 py-2.5 text-sm text-white placeholder-slate-500 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/40"
            />
            <select
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
              className="rounded-xl border border-slate-700 bg-slate-800/80 px-3 py-2.5 text-sm text-slate-300 focus:outline-none focus:border-purple-500 cursor-pointer"
            >
              {(Object.entries(SORT_LABELS) as [SortOption, string][]).map(([value, label]) => (
                <option key={value} value={value}>{label}</option>
              ))}
            </select>
          </div>
        )}

        {/* Grid */}
        {tokens.length === 0 ? (
          <div className="text-center py-24 text-slate-500">
            <p className="text-5xl mb-4">🌕</p>
            <p className="text-lg font-semibold">No tokens yet.</p>
            <p className="text-slate-600 text-sm mt-1 mb-6">Be the first to launch a meme coin.</p>
            <Link
              href="/meme/create"
              className="px-6 py-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-sm font-semibold transition-colors"
            >
              Launch a Token
            </Link>
          </div>
        ) : displayed.length === 0 ? (
          <div className="text-center py-16 text-slate-500">
            <p className="text-3xl mb-3">🔍</p>
            <p className="font-semibold">No tokens match &ldquo;{search}&rdquo;</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {displayed.map((token) => {
              const pct   = Math.min(Number((token.cureRaised * 10_000n) / GRAD_THRESHOLD) / 100, 100);
              const color = COLORS[token.originalIdx % COLORS.length];
              return (
                <Link
                  key={token.address}
                  href={`/meme/${token.address}`}
                  className="rounded-2xl border border-slate-700 bg-slate-800/60 p-5 flex flex-col gap-3 hover:border-slate-500 hover:bg-slate-800/80 transition-all group"
                >
                  {/* Token identity */}
                  <div className="flex items-center gap-3">
                    <span
                      className="w-11 h-11 rounded-full flex items-center justify-center text-white font-bold text-lg shrink-0"
                      style={{ background: color }}
                    >
                      {token.symbol[0]}
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="font-semibold truncate group-hover:text-purple-300 transition-colors">
                        {token.name}
                      </div>
                      <div className="text-slate-400 text-xs">${token.symbol}</div>
                    </div>
                    {token.graduated && (
                      <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30 shrink-0">
                        🎓 Grad
                      </span>
                    )}
                  </div>

                  {/* Progress bar */}
                  <div>
                    <div className="flex justify-between text-xs text-slate-500 mb-1.5">
                      <span>{pct.toFixed(1)}% to graduation</span>
                      <span>{parseFloat(formatUnits(token.cureRaised, 18)).toFixed(4)} / 1000 CURE</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{ width: `${pct}%`, background: token.graduated ? "#22c55e" : color }}
                      />
                    </div>
                  </div>

                  <p className="text-xs text-slate-600 font-mono truncate">{token.address}</p>
                </Link>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}
