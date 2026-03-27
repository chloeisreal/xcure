"use client";

import { useState, useRef, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  usePublicClient,
  useReadContract,
  useReadContracts,
  useWriteContract,
} from "wagmi";
import { formatUnits, parseUnits, maxUint256, erc20Abi } from "viem";
import localDeployment from "@/deployments/local.json";
import arbitrumSepoliaDeployment from "@/deployments/arbitrum-sepolia.json";

// ── ABIs ──────────────────────────────────────────────────────────────────────
const SWAP_ABI = [
  { name: "reserveA", type: "function", stateMutability: "view",        inputs: [],                                                                                                                   outputs: [{ name: "", type: "uint256" }] },
  { name: "reserveB", type: "function", stateMutability: "view",        inputs: [],                                                                                                                   outputs: [{ name: "", type: "uint256" }] },
  { name: "swap",     type: "function", stateMutability: "nonpayable",  inputs: [{ name: "tokenIn", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "minAmountOut", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const MINT_ABI = [
  { name: "mint", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

// ── AMM math ──────────────────────────────────────────────────────────────────
function ammAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amountIn === 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  const numerator       = amountInWithFee * reserveOut;
  const denominator     = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

// ── Token list ────────────────────────────────────────────────────────────────
type TokenSymbol = "WETH" | "CURE" | "BAO";

const TOKEN_META: Record<TokenSymbol, { name: string; color: string; decimals: number }> = {
  WETH: { name: "Wrapped Ether", color: "#16a34a", decimals: 18 },
  CURE: { name: "Mock CURE",     color: "#7c3aed", decimals: 18 },
  BAO:  { name: "Mock BAO",      color: "#2563eb", decimals: 18 },
};
const ALL_SYMBOLS: TokenSymbol[] = ["WETH", "CURE", "BAO"];

// ── Pair → contract map (canonical key = "A-B" where A < B alphabetically in pair order) ──
// Key is always the canonical direction stored in the contract (tokenA-tokenB).
// We store BOTH directions for easy lookup.
type PairEntry = { address: `0x${string}`; symbolA: TokenSymbol; symbolB: TokenSymbol };

function buildPairMap(dep: Record<string, unknown>): Map<string, PairEntry> {
  const map = new Map<string, PairEntry>();
  const ZERO = "0x0000000000000000000000000000000000000000";

  const pairs: Array<[TokenSymbol, TokenSymbol, string]> = [
    ["WETH", "CURE", (dep.SimpleSwapWETHCURE as string | undefined) ?? ZERO],
    ["CURE", "BAO",  (dep.SimpleSwap         as string | undefined) ?? ZERO],
    ["BAO",  "WETH", (dep.SimpleSwapBAOWETH  as string | undefined) ?? ZERO],
  ];

  for (const [symA, symB, addr] of pairs) {
    if (addr === ZERO) continue;
    const entry: PairEntry = { address: addr as `0x${string}`, symbolA: symA, symbolB: symB };
    map.set(`${symA}-${symB}`, entry);
    map.set(`${symB}-${symA}`, entry);
  }
  return map;
}

// ── Sub-components ────────────────────────────────────────────────────────────
function TokenAvatar({ symbol, color, size = 28 }: { symbol: string; color: string; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.38, background: color }}>
      {symbol[0]}
    </span>
  );
}

function TokenSelect({
  value, onChange, exclude, addresses, disabled,
}: {
  value: TokenSymbol;
  onChange: (s: TokenSymbol) => void;
  exclude: TokenSymbol;
  addresses: Record<TokenSymbol, string>;
  disabled?: boolean;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function onOutside(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", onOutside);
    return () => document.removeEventListener("mousedown", onOutside);
  }, []);

  return (
    <div ref={ref} className="relative shrink-0">
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((o) => !o)}
        className="flex items-center gap-2 px-3 py-2 rounded-xl border border-slate-600 bg-slate-800 hover:border-purple-500/70 transition-colors disabled:opacity-50"
      >
        <TokenAvatar symbol={value} color={TOKEN_META[value].color} size={22} />
        <span className="text-white text-sm font-semibold">{value}</span>
        <svg className={`w-3 h-3 text-slate-400 transition-transform ${open ? "rotate-180" : ""}`} viewBox="0 0 10 6" fill="none">
          <path d="M1 1l4 4 4-4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>

      {open && (
        <div className="absolute top-full mt-1.5 left-0 z-50 w-44 rounded-2xl border border-slate-700 bg-slate-900 shadow-2xl overflow-hidden">
          <div className="px-3 pt-2.5 pb-1 text-[10px] text-slate-500 uppercase tracking-wider font-semibold">Select token</div>
          {ALL_SYMBOLS.filter((s) => s !== exclude).map((sym) => (
            <button
              key={sym}
              type="button"
              onClick={() => { onChange(sym); setOpen(false); }}
              className={`w-full flex items-center gap-3 px-3 py-2.5 hover:bg-slate-800 transition-colors ${sym === value ? "bg-purple-600/10" : ""}`}
            >
              <TokenAvatar symbol={sym} color={TOKEN_META[sym].color} size={22} />
              <div className="text-left min-w-0">
                <div className="text-white text-sm font-semibold leading-tight">{sym}</div>
                <div className="text-slate-500 text-xs truncate">{TOKEN_META[sym].name}</div>
              </div>
              {sym === value && <span className="ml-auto text-purple-400 text-xs">✓</span>}
            </button>
          ))}
          <div className="px-3 pt-1 pb-2.5 text-[10px] text-slate-600 font-mono truncate">{addresses[value]?.slice(0, 14)}…</div>
        </div>
      )}
    </div>
  );
}

// ── Main component ─────────────────────────────────────────────────────────────
export default function LocalSwapWidget() {
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const isArbitrumSepolia = walletChainId === 421614;
  const dep = (isArbitrumSepolia ? arbitrumSepoliaDeployment : localDeployment) as Record<string, unknown>;
  const networkLabel = isArbitrumSepolia ? "Arbitrum Sepolia" : "Hardhat Local";

  const TOKEN_ADDRESSES: Record<TokenSymbol, `0x${string}`> = {
    CURE: ((dep.MockCURE as string | undefined) ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    BAO:  ((dep.MockBAO  as string | undefined) ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
    WETH: ((dep.MockWETH as string | undefined) ?? "0x0000000000000000000000000000000000000000") as `0x${string}`,
  };

  const pairMap = buildPairMap(dep);

  // ── Swap state ──────────────────────────────────────────────────────────────
  const [fromSymbol, setFromSymbol] = useState<TokenSymbol>("WETH");
  const [toSymbol,   setToSymbol]   = useState<TokenSymbol>("CURE");
  const [inputAmount, setInputAmount] = useState("");
  const [txStatus, setTxStatus] = useState<"idle"|"approving"|"swapping"|"success"|"error">("idle");
  const [txHash,   setTxHash]   = useState<string | null>(null);
  const [txError,  setTxError]  = useState<string | null>(null);

  // ── Faucet state ────────────────────────────────────────────────────────────
  const [faucetStatus,     setFaucetStatus]     = useState<"idle"|"minting"|"success"|"error">("idle");
  const [faucetError,      setFaucetError]      = useState<string | null>(null);
  const [wethFaucetStatus, setWethFaucetStatus] = useState<"idle"|"minting"|"success"|"error">("idle");
  const [wethFaucetError,  setWethFaucetError]  = useState<string | null>(null);

  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // ── Pair resolution ─────────────────────────────────────────────────────────
  const pairEntry  = pairMap.get(`${fromSymbol}-${toSymbol}`) ?? null;
  const hasPair    = pairEntry !== null;
  // Is the "from" token the A-side of the contract?
  const fromIsA    = hasPair ? pairEntry!.symbolA === fromSymbol : true;
  const swapAddr   = pairEntry?.address ?? ("0x0000000000000000000000000000000000000000" as `0x${string}`);

  const fromToken  = { symbol: fromSymbol, address: TOKEN_ADDRESSES[fromSymbol], ...TOKEN_META[fromSymbol] };
  const toToken    = { symbol: toSymbol,   address: TOKEN_ADDRESSES[toSymbol],   ...TOKEN_META[toSymbol]   };

  const busy = txStatus === "approving" || txStatus === "swapping";

  // ── Contract reads ──────────────────────────────────────────────────────────
  const { data: reserves, refetch: refetchReserves } = useReadContracts({
    contracts: [
      { address: swapAddr, abi: SWAP_ABI, functionName: "reserveA" },
      { address: swapAddr, abi: SWAP_ABI, functionName: "reserveB" },
    ],
    query: { enabled: hasPair, refetchInterval: 8000 },
  });
  const reserveA = (reserves?.[0]?.result ?? 0n) as bigint;
  const reserveB = (reserves?.[1]?.result ?? 0n) as bigint;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fromToken.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, swapAddr],
    query: { enabled: hasPair && !!address },
  });

  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: ALL_SYMBOLS.map((sym) => ({
      address: TOKEN_ADDRESSES[sym],
      abi: erc20Abi,
      functionName: "balanceOf" as const,
      args: [address!] as [`0x${string}`],
    })),
    query: { enabled: !!address },
  });
  const balanceMap = Object.fromEntries(
    ALL_SYMBOLS.map((sym, i) => [sym, (balances?.[i]?.result ?? 0n) as bigint])
  ) as Record<TokenSymbol, bigint>;

  // ── Output calculation ──────────────────────────────────────────────────────
  const parsedAmount = parseFloat(inputAmount);
  const validAmount  = !isNaN(parsedAmount) && parsedAmount > 0;

  const outputAmount: bigint | null = (() => {
    if (!validAmount || !hasPair) return null;
    try {
      const amountIn = parseUnits(inputAmount, fromToken.decimals);
      const [rIn, rOut] = fromIsA ? [reserveA, reserveB] : [reserveB, reserveA];
      const out = ammAmountOut(amountIn, rIn, rOut);
      return out > 0n ? out : null;
    } catch { return null; }
  })();

  const outputFormatted = outputAmount !== null ? parseFloat(formatUnits(outputAmount, toToken.decimals)) : null;
  const rate = outputFormatted !== null && validAmount ? outputFormatted / parsedAmount : null;

  // ── Handlers ────────────────────────────────────────────────────────────────
  function handleFlip() {
    setFromSymbol(toSymbol);
    setToSymbol(fromSymbol);
    setInputAmount("");
    setTxStatus("idle");
    setTxError(null);
    setTxHash(null);
  }

  function handleFromChange(sym: TokenSymbol) {
    if (sym === toSymbol) setToSymbol(fromSymbol); // auto-flip To
    setFromSymbol(sym);
    setInputAmount("");
    setTxStatus("idle");
    setTxError(null);
    setTxHash(null);
  }

  function handleToChange(sym: TokenSymbol) {
    if (sym === fromSymbol) setFromSymbol(toSymbol); // auto-flip From
    setToSymbol(sym);
    setInputAmount("");
    setTxStatus("idle");
    setTxError(null);
    setTxHash(null);
  }

  async function handleSwap() {
    if (!validAmount || !address || !publicClient || outputAmount === null || !hasPair) return;
    setTxHash(null);
    setTxError(null);
    try {
      const fees     = await publicClient.estimateFeesPerGas();
      const amountIn = parseUnits(inputAmount, fromToken.decimals);
      const minOut   = (outputAmount * 99n) / 100n;

      if ((allowance ?? 0n) < amountIn) {
        setTxStatus("approving");
        const approveTx = await writeContractAsync({
          address: fromToken.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [swapAddr, maxUint256],
          maxFeePerGas:         fees.maxFeePerGas,
          maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        await refetchAllowance();
      }

      setTxStatus("swapping");
      const swapTx = await writeContractAsync({
        address: swapAddr,
        abi: SWAP_ABI,
        functionName: "swap",
        args: [fromToken.address, amountIn, minOut],
        maxFeePerGas:         fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });
      await publicClient.waitForTransactionReceipt({ hash: swapTx });
      setTxHash(swapTx);
      setTxStatus("success");
      setInputAmount("");
      await refetchReserves();
      await refetchAllowance();
      await refetchBalances();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Transaction failed";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) setTxError(msg);
      setTxStatus("error");
    }
  }

  async function handleFaucet() {
    if (!address || !publicClient) return;
    setFaucetStatus("minting");
    setFaucetError(null);
    try {
      const fees   = await publicClient.estimateFeesPerGas();
      const amount = parseUnits("10000", 18);
      const tx1 = await writeContractAsync({ address: TOKEN_ADDRESSES.CURE, abi: MINT_ABI, functionName: "mint", args: [address, amount], maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      const tx2 = await writeContractAsync({ address: TOKEN_ADDRESSES.BAO,  abi: MINT_ABI, functionName: "mint", args: [address, amount], maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
      await publicClient.waitForTransactionReceipt({ hash: tx2 });
      setFaucetStatus("success");
      await refetchBalances();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Mint failed";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) setFaucetError(msg);
      setFaucetStatus("error");
    }
  }

  async function handleWethFaucet() {
    if (!address || !publicClient) return;
    setWethFaucetStatus("minting");
    setWethFaucetError(null);
    try {
      const fees   = await publicClient.estimateFeesPerGas();
      const amount = parseUnits("1", 18);
      const tx = await writeContractAsync({ address: TOKEN_ADDRESSES.WETH, abi: MINT_ABI, functionName: "mint", args: [address, amount], maxFeePerGas: fees.maxFeePerGas, maxPriorityFeePerGas: fees.maxPriorityFeePerGas });
      await publicClient.waitForTransactionReceipt({ hash: tx });
      setWethFaucetStatus("success");
      await refetchBalances();
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Mint failed";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) setWethFaucetError(msg);
      setWethFaucetStatus("error");
    }
  }

  // ── Swap button ──────────────────────────────────────────────────────────────
  function getButton(): { label: string; disabled: boolean; onClick?: () => void } {
    if (!hasPair)     return { label: "No trading pair available", disabled: true };
    if (!isConnected) return { label: "Connect Wallet", disabled: true };
    if (!validAmount) return { label: "Enter Amount", disabled: true };
    if (reserveA === 0n && reserveB === 0n) return { label: "Pool has no liquidity", disabled: true };
    if (outputAmount === null)              return { label: "Insufficient liquidity", disabled: true };
    if (txStatus === "approving")           return { label: "Approving…", disabled: true };
    if (txStatus === "swapping")            return { label: "Swapping…", disabled: true };
    return { label: `Swap ${fromToken.symbol} → ${toToken.symbol}`, disabled: false, onClick: handleSwap };
  }

  const btn = getButton();
  const tokenAddressStrings = Object.fromEntries(
    ALL_SYMBOLS.map((s) => [s, TOKEN_ADDRESSES[s]])
  ) as Record<TokenSymbol, string>;

  // Pool label: show which contract's reserves we're reading
  const poolLabel = pairEntry ? `${pairEntry.symbolA} / ${pairEntry.symbolB}` : null;

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      <div className="flex justify-end"><ConnectButton /></div>

      <div className="rounded-2xl border border-slate-700 bg-[#111827] p-6 flex flex-col gap-5">
        {/* Header */}
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Swap</h2>
          <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-1 rounded-full">
            ⬡ {networkLabel}
          </span>
        </div>

        {/* Pool reserves */}
        {hasPair && (reserveA > 0n || reserveB > 0n) && (
          <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-2 flex justify-between text-xs text-slate-500">
            <span>Pool ({poolLabel}): {parseFloat(formatUnits(reserveA, 18)).toLocaleString()} {pairEntry!.symbolA}</span>
            <span>{parseFloat(formatUnits(reserveB, 18)).toLocaleString(undefined, { maximumFractionDigits: 6 })} {pairEntry!.symbolB}</span>
          </div>
        )}

        {/* Balances + faucet */}
        {isConnected && (
          <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-2 flex items-center justify-between gap-2 flex-wrap">
            <div className="text-xs text-slate-500 flex gap-3 flex-wrap">
              {ALL_SYMBOLS.map((sym) => (
                <span key={sym}>
                  {parseFloat(formatUnits(balanceMap[sym], 18)).toLocaleString(undefined, { maximumFractionDigits: sym === "WETH" ? 4 : 2 })} {sym}
                </span>
              ))}
            </div>
            <div className="flex gap-1 shrink-0">
              <button onClick={handleFaucet} disabled={faucetStatus === "minting"}
                className="text-xs px-2 py-1 rounded-md border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-40 transition-colors">
                {faucetStatus === "minting" ? "Minting…" : faucetStatus === "success" ? "Minted!" : "Get tokens"}
              </button>
              <button onClick={handleWethFaucet} disabled={wethFaucetStatus === "minting"}
                className="text-xs px-2 py-1 rounded-md border border-green-700/60 bg-green-900/30 hover:bg-green-900/50 text-green-400 disabled:opacity-40 transition-colors">
                {wethFaucetStatus === "minting" ? "Minting…" : wethFaucetStatus === "success" ? "Minted!" : "Get WETH"}
              </button>
            </div>
          </div>
        )}
        {faucetStatus     === "error" && faucetError     && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">{faucetError}</div>}
        {wethFaucetStatus === "error" && wethFaucetError && <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">{wethFaucetError}</div>}

        {/* From */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 flex flex-col gap-2">
          <span className="text-xs text-slate-500 font-medium">From</span>
          <div className="flex items-center gap-3">
            <TokenSelect value={fromSymbol} onChange={handleFromChange} exclude={toSymbol} addresses={tokenAddressStrings} disabled={busy} />
            <input
              type="number" min="0" step="any" placeholder="0.0" value={inputAmount}
              onChange={(e) => { setInputAmount(e.target.value); setTxStatus("idle"); setTxError(null); }}
              disabled={busy}
              className="flex-1 bg-transparent text-white text-xl font-semibold placeholder-slate-700 focus:outline-none text-right disabled:opacity-50"
            />
          </div>
          {isConnected && (
            <div className="flex justify-between text-xs text-slate-600">
              <span>{TOKEN_META[fromSymbol].name}</span>
              <span>Balance: {parseFloat(formatUnits(balanceMap[fromSymbol], 18)).toLocaleString(undefined, { maximumFractionDigits: fromSymbol === "WETH" ? 4 : 2 })}</span>
            </div>
          )}
        </div>

        {/* Flip button */}
        <div className="flex justify-center -my-1">
          <button onClick={handleFlip} disabled={busy}
            className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 hover:border-purple-500/60 flex items-center justify-center text-slate-400 hover:text-white transition-all disabled:opacity-40">
            ⇅
          </button>
        </div>

        {/* To */}
        <div className="rounded-xl border border-slate-700 bg-slate-800/60 px-4 py-3 flex flex-col gap-2">
          <span className="text-xs text-slate-500 font-medium">To (estimated)</span>
          <div className="flex items-center gap-3">
            <TokenSelect value={toSymbol} onChange={handleToChange} exclude={fromSymbol} addresses={tokenAddressStrings} disabled={busy} />
            <span className="flex-1 text-right text-xl font-semibold text-white">
              {outputFormatted !== null
                ? (outputFormatted < 0.0001 ? outputFormatted.toExponential(4) : outputFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 }))
                : <span className="text-slate-700">0.0</span>
              }
            </span>
          </div>
          {isConnected && (
            <div className="flex justify-between text-xs text-slate-600">
              <span>{TOKEN_META[toSymbol].name}</span>
              <span>Balance: {parseFloat(formatUnits(balanceMap[toSymbol], 18)).toLocaleString(undefined, { maximumFractionDigits: toSymbol === "WETH" ? 4 : 2 })}</span>
            </div>
          )}
        </div>

        {/* No pair warning */}
        {!hasPair && fromSymbol !== toSymbol && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs text-amber-400">
            No trading pair available for {fromSymbol} / {toSymbol}
          </div>
        )}

        {/* Quote details */}
        {outputFormatted !== null && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 flex flex-col gap-2">
            {rate !== null && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Rate</span>
                <span>1 {fromToken.symbol} ≈ {rate < 0.001 ? rate.toExponential(4) : rate.toFixed(6)} {toToken.symbol}</span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500"><span>Fee</span><span>0.3% (AMM)</span></div>
            <div className="flex justify-between text-xs text-slate-500"><span>Slippage tolerance</span><span>1%</span></div>
          </div>
        )}

        {/* Tx success */}
        {txStatus === "success" && txHash && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 flex flex-col gap-1">
            <span className="font-semibold">Swap confirmed!</span>
            {isArbitrumSepolia && (
              <a href={`https://sepolia.arbiscan.io/tx/${txHash}`} target="_blank" rel="noopener noreferrer"
                className="text-green-300 underline">View on Arbiscan ↗</a>
            )}
            <span className="font-mono break-all text-green-300">{txHash.slice(0, 22)}…{txHash.slice(-8)}</span>
          </div>
        )}

        {/* Tx error */}
        {txStatus === "error" && txError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">{txError}</div>
        )}

        {/* Swap button */}
        <button disabled={btn.disabled || busy} onClick={btn.onClick}
          className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
          {busy && (
            <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
          )}
          {btn.label}
        </button>

        <p className="text-center text-xs text-slate-600">SimpleSwap AMM · {networkLabel} (chainId {walletChainId})</p>
      </div>
    </div>
  );
}
