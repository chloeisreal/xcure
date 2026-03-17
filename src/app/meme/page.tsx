"use client";

import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useReadContract, useReadContracts } from "wagmi";
import { formatEther } from "viem";
import { FACTORY_ADDRESS, FACTORY_ABI, MEME_TOKEN_ABI, GRAD_THRESHOLD } from "@/lib/meme-abis";

const COLORS = ["#7c3aed", "#2563eb", "#059669", "#dc2626", "#d97706", "#db2777", "#0891b2", "#7c2d12"];

export default function MemePage() {
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
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "name"      } as const,
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "symbol"    } as const,
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "ethRaised" } as const,
      { address: addr, abi: MEME_TOKEN_ABI, functionName: "graduated" } as const,
    ]),
    query: { enabled: tokenAddrs.length > 0, refetchInterval: 10_000 },
  });

  const tokens = tokenAddrs.map((addr, i) => ({
    address:   addr,
    name:      (tokenData?.[i * 4    ]?.result ?? "…")    as string,
    symbol:    (tokenData?.[i * 4 + 1]?.result ?? "…")    as string,
    ethRaised: (tokenData?.[i * 4 + 2]?.result ?? 0n)     as bigint,
    graduated: (tokenData?.[i * 4 + 3]?.result ?? false)  as boolean,
  }));

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
        <div className="rounded-xl border border-slate-700/50 bg-slate-800/30 px-5 py-3 flex gap-6 text-sm mb-6">
          <span className="text-slate-400">Tokens launched: <span className="text-white font-semibold">{Number(length ?? 0n)}</span></span>
          <span className="text-slate-400">Factory: <span className="font-mono text-xs text-slate-300">{FACTORY_ADDRESS.slice(0, 10)}…</span></span>
        </div>

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
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {tokens.map((token, i) => {
              const pct = Math.min(
                Number((token.ethRaised * 10_000n) / GRAD_THRESHOLD) / 100,
                100,
              );
              const color = COLORS[i % COLORS.length];
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
                      <span>{parseFloat(formatEther(token.ethRaised)).toFixed(4)} / 0.1 ETH</span>
                    </div>
                    <div className="h-2 rounded-full bg-slate-700">
                      <div
                        className="h-2 rounded-full transition-all"
                        style={{
                          width: `${pct}%`,
                          background: token.graduated ? "#22c55e" : color,
                        }}
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
