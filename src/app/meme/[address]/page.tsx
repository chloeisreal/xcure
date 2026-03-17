"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useReadContracts, useWriteContract } from "wagmi";
import { formatEther, formatUnits, parseEther, parseUnits } from "viem";
import {
  MEME_TOKEN_ABI,
  GRAD_THRESHOLD,
  estimateBuyTokens,
  estimateSellETH,
} from "@/lib/meme-abis";

const ZERO_ADDR = "0x0000000000000000000000000000000000000000" as const;

export default function TokenPage() {
  const { address } = useParams<{ address: string }>();
  const tokenAddr   = address as `0x${string}`;

  const { address: userAddr, isConnected } = useAccount();
  const publicClient    = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [tab,       setTab]       = useState<"buy" | "sell">("buy");
  const [buyInput,  setBuyInput]  = useState("");  // ETH amount string
  const [sellInput, setSellInput] = useState("");  // token amount string
  const [txStatus,  setTxStatus]  = useState<"idle" | "pending" | "success" | "error">("idle");
  const [txHash,    setTxHash]    = useState<string | null>(null);
  const [txError,   setTxError]   = useState<string | null>(null);
  const [meta, setMeta] = useState<{ imageURI?: string; description?: string }>({});

  useEffect(() => {
    try {
      const saved = localStorage.getItem(`meme:${tokenAddr}`);
      if (saved) setMeta(JSON.parse(saved));
    } catch {}
  }, [tokenAddr]);

  // ── Contract reads (batched) ────────────────────────────────────────────
  const effectiveUser = userAddr ?? ZERO_ADDR;
  const { data, refetch } = useReadContracts({
    contracts: [
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "name"         },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "symbol"       },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "tokensSold"   },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "ethRaised"    },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "graduated"    },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "creator"      },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "currentPrice" },
      { address: tokenAddr, abi: MEME_TOKEN_ABI, functionName: "balanceOf", args: [effectiveUser] },
    ] as const,
    query: { refetchInterval: 6_000 },
  });

  const name        = (data?.[0]?.result ?? "…")    as string;
  const symbol      = (data?.[1]?.result ?? "…")    as string;
  const tokensSold  = (data?.[2]?.result ?? 0n)     as bigint;
  const ethRaised   = (data?.[3]?.result ?? 0n)     as bigint;
  const graduated   = (data?.[4]?.result ?? false)  as boolean;
  const creator     = (data?.[5]?.result ?? ZERO_ADDR) as string;
  const spotPrice   = (data?.[6]?.result ?? 0n)     as bigint;
  const myBalance   = (data?.[7]?.result ?? 0n)     as bigint;

  const pct = Math.min(Number((ethRaised * 10_000n) / GRAD_THRESHOLD) / 100, 100);

  // ── Client-side estimates ───────────────────────────────────────────────
  const buyEthBig = (() => { try { return parseEther(buyInput || "0"); }    catch { return 0n; } })();
  const sellAmtBig = (() => { try { return parseUnits(sellInput || "0", 18); } catch { return 0n; } })();

  const estimatedTokens = estimateBuyTokens(buyEthBig, tokensSold);
  const estimatedETH    = estimateSellETH(sellAmtBig, tokensSold);

  // ── Transactions ────────────────────────────────────────────────────────
  function resetTx() { setTxStatus("idle"); setTxHash(null); setTxError(null); }

  async function handleBuy() {
    if (!publicClient || buyEthBig === 0n) return;
    setTxStatus("pending"); resetTx(); setTxStatus("pending");
    try {
      const minTokens = (estimatedTokens * 95n) / 100n; // 5% slippage
      const fees = await publicClient.estimateFeesPerGas();
      const hash = await writeContractAsync({
        address: tokenAddr,
        abi: MEME_TOKEN_ABI,
        functionName: "buy",
        args: [minTokens],
        value: buyEthBig,
        maxFeePerGas:         fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setTxStatus("success");
      setBuyInput("");
      refetch();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Transaction failed";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied"))
        setTxError(msg);
      setTxStatus("error");
    }
  }

  async function handleSell() {
    if (!publicClient || sellAmtBig === 0n) return;
    setTxStatus("pending"); resetTx(); setTxStatus("pending");
    try {
      const fees = await publicClient.estimateFeesPerGas();
      const hash = await writeContractAsync({
        address: tokenAddr,
        abi: MEME_TOKEN_ABI,
        functionName: "sell",
        args: [sellAmtBig],
        maxFeePerGas:         fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      await publicClient.waitForTransactionReceipt({ hash });
      setTxHash(hash);
      setTxStatus("success");
      setSellInput("");
      refetch();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Transaction failed";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied"))
        setTxError(msg);
      setTxStatus("error");
    }
  }

  const busy = txStatus === "pending";

  return (
    <div className="min-h-screen bg-[#111827] text-white p-6">
      <div className="max-w-2xl mx-auto flex flex-col gap-5">

        {/* Nav */}
        <div className="flex items-center justify-between">
          <Link href="/meme" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← All Tokens
          </Link>
          <ConnectButton />
        </div>

        {/* ── Token header card ─────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 flex flex-col gap-4">
          {/* Identity */}
          <div className="flex items-start gap-4">
            {meta.imageURI ? (
              <img
                src={meta.imageURI}
                alt={symbol}
                className="w-16 h-16 rounded-2xl object-cover shrink-0 border border-slate-700"
              />
            ) : (
              <div className="w-16 h-16 rounded-2xl bg-purple-600 flex items-center justify-center text-2xl font-bold shrink-0">
                {symbol[0] ?? "?"}
              </div>
            )}
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h1 className="text-xl font-bold">{name}</h1>
                <span className="text-slate-400">${symbol}</span>
                {graduated && (
                  <span className="text-xs px-2 py-0.5 rounded-full bg-green-500/20 text-green-400 border border-green-500/30">
                    🎓 Graduated
                  </span>
                )}
              </div>
              {meta.description && (
                <p className="text-slate-400 text-sm mt-1">{meta.description}</p>
              )}
              <p className="text-slate-600 text-xs mt-1 font-mono truncate">
                creator: {creator}
              </p>
            </div>
          </div>

          {/* Stats grid */}
          <div className="grid grid-cols-3 gap-3">
            {[
              { label: "Spot Price",   value: `${Number(spotPrice).toLocaleString()} wei` },
              { label: "ETH Raised",   value: `${parseFloat(formatEther(ethRaised)).toFixed(5)} ETH` },
              { label: "Tokens Sold",  value: `${(parseFloat(formatUnits(tokensSold, 18)) / 1_000_000).toFixed(2)}M` },
            ].map((s) => (
              <div
                key={s.label}
                className="rounded-xl bg-slate-900/60 border border-slate-700/40 px-3 py-2.5"
              >
                <div className="text-xs text-slate-500">{s.label}</div>
                <div className="text-sm font-semibold mt-0.5 truncate">{s.value}</div>
              </div>
            ))}
          </div>

          {/* Graduation progress bar */}
          <div>
            <div className="flex justify-between text-xs text-slate-400 mb-1.5">
              <span>Graduation Progress</span>
              <span>
                {pct.toFixed(2)}% · {parseFloat(formatEther(ethRaised)).toFixed(5)} / 0.1 ETH
              </span>
            </div>
            <div className="h-3 rounded-full bg-slate-700 overflow-hidden">
              <div
                className="h-3 rounded-full transition-all duration-500"
                style={{
                  width: `${pct}%`,
                  background: graduated
                    ? "#22c55e"
                    : "linear-gradient(to right, #7c3aed, #6d28d9)",
                }}
              />
            </div>
          </div>

          {/* Contract address */}
          <p className="text-xs text-slate-600 font-mono truncate">
            {tokenAddr}
          </p>
        </div>

        {/* ── Trade card ────────────────────────────────────────────────── */}
        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6">
          {graduated ? (
            <div className="text-center py-10">
              <div className="text-5xl mb-3">🎓</div>
              <div className="text-green-400 font-semibold text-lg">Token Graduated!</div>
              <p className="text-slate-400 text-sm mt-2">
                The bonding curve is closed. Trade on a DEX.
              </p>
            </div>
          ) : (
            <>
              {/* Buy / Sell tabs */}
              <div className="flex rounded-xl bg-slate-900/60 p-1 mb-5 gap-1">
                {(["buy", "sell"] as const).map((t) => (
                  <button
                    key={t}
                    onClick={() => { setTab(t); resetTx(); }}
                    className={`flex-1 py-2 rounded-lg text-sm font-semibold capitalize transition-colors ${
                      tab === t
                        ? t === "buy"
                          ? "bg-green-600 text-white"
                          : "bg-red-600 text-white"
                        : "text-slate-400 hover:text-white"
                    }`}
                  >
                    {t}
                  </button>
                ))}
              </div>

              {tab === "buy" ? (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                      ETH to spend
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="0.001"
                      value={buyInput}
                      onChange={(e) => { setBuyInput(e.target.value); resetTx(); }}
                      disabled={busy}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:border-green-500 focus:ring-1 focus:ring-green-500/30 disabled:opacity-50"
                    />
                  </div>

                  {estimatedTokens > 0n && (
                    <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 px-4 py-3 flex justify-between items-center text-sm">
                      <span className="text-slate-400">You receive ~</span>
                      <span className="font-semibold text-lg">
                        {parseFloat(formatUnits(estimatedTokens, 18)).toLocaleString(undefined, {
                          maximumFractionDigits: 2,
                        })}{" "}
                        <span className="text-green-400 text-sm">{symbol}</span>
                      </span>
                    </div>
                  )}

                  {isConnected && (
                    <p className="text-xs text-slate-500">
                      Your balance:{" "}
                      {parseFloat(formatUnits(myBalance, 18)).toLocaleString()} {symbol}
                    </p>
                  )}

                  <button
                    onClick={handleBuy}
                    disabled={!isConnected || busy || buyEthBig === 0n || estimatedTokens === 0n}
                    className="w-full rounded-xl bg-green-600 hover:bg-green-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {busy && <Spinner />}
                    {busy ? "Buying…" : !isConnected ? "Connect Wallet" : `Buy ${symbol}`}
                  </button>
                </div>
              ) : (
                <div className="flex flex-col gap-4">
                  <div>
                    <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                      {symbol} to sell
                    </label>
                    <input
                      type="number"
                      step="any"
                      min="0"
                      placeholder="10000"
                      value={sellInput}
                      onChange={(e) => { setSellInput(e.target.value); resetTx(); }}
                      disabled={busy}
                      className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-3 text-sm placeholder-slate-600 focus:outline-none focus:border-red-500 focus:ring-1 focus:ring-red-500/30 disabled:opacity-50"
                    />
                  </div>

                  {estimatedETH > 0n && (
                    <div className="rounded-xl bg-slate-900/60 border border-slate-700/40 px-4 py-3 flex justify-between items-center text-sm">
                      <span className="text-slate-400">You receive ~</span>
                      <span className="font-semibold text-lg">
                        {parseFloat(formatEther(estimatedETH)).toFixed(6)}{" "}
                        <span className="text-red-400 text-sm">ETH</span>
                      </span>
                    </div>
                  )}

                  {isConnected && (
                    <div className="flex justify-between items-center">
                      <p className="text-xs text-slate-500">
                        Balance: {parseFloat(formatUnits(myBalance, 18)).toLocaleString()} {symbol}
                      </p>
                      {myBalance > 0n && (
                        <button
                          onClick={() => setSellInput(formatUnits(myBalance, 18))}
                          className="text-xs text-purple-400 hover:text-purple-300 transition-colors"
                        >
                          Max
                        </button>
                      )}
                    </div>
                  )}

                  <button
                    onClick={handleSell}
                    disabled={
                      !isConnected || busy || sellAmtBig === 0n || sellAmtBig > myBalance
                    }
                    className="w-full rounded-xl bg-red-600 hover:bg-red-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
                  >
                    {busy && <Spinner />}
                    {busy ? "Selling…" : !isConnected ? "Connect Wallet" : `Sell ${symbol}`}
                  </button>
                </div>
              )}

              {/* Fee note */}
              <p className="text-xs text-slate-600 mt-3 text-center">1% fee · 5% slippage tolerance</p>

              {/* Tx feedback */}
              {txStatus === "success" && txHash && (
                <div className="mt-4 rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 flex flex-col gap-1">
                  <span className="font-semibold">Transaction confirmed!</span>
                  <a
                    href={`https://sepolia.arbiscan.io/tx/${txHash}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="underline hover:text-green-300"
                  >
                    View on Arbiscan ↗
                  </a>
                </div>
              )}
              {txStatus === "error" && txError && (
                <div className="mt-4 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">
                  {txError}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

function Spinner() {
  return (
    <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
