"use client";

import { useState } from "react";
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

const SWAP_ABI = [
  { name: "reserveA", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "reserveB", type: "function", stateMutability: "view", inputs: [], outputs: [{ name: "", type: "uint256" }] },
  { name: "swap", type: "function", stateMutability: "nonpayable", inputs: [{ name: "tokenIn", type: "address" }, { name: "amountIn", type: "uint256" }, { name: "minAmountOut", type: "uint256" }], outputs: [{ name: "", type: "uint256" }] },
] as const;

const MINT_ABI = [
  { name: "mint", type: "function", stateMutability: "nonpayable", inputs: [{ name: "to", type: "address" }, { name: "amount", type: "uint256" }], outputs: [] },
] as const;

function ammAmountOut(amountIn: bigint, reserveIn: bigint, reserveOut: bigint): bigint {
  if (reserveIn === 0n || reserveOut === 0n || amountIn === 0n) return 0n;
  const amountInWithFee = amountIn * 997n;
  const numerator = amountInWithFee * reserveOut;
  const denominator = reserveIn * 1000n + amountInWithFee;
  return numerator / denominator;
}

function TokenAvatar({ symbol, color, size = 28 }: { symbol: string; color: string; size?: number }) {
  return (
    <span className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, background: color }}>
      {symbol[0]}
    </span>
  );
}

export default function LocalSwapWidget() {
  // useAccount().chainId reflects the wallet's actual current chain.
  // useChainId() reflects wagmi's configured default and can stay on the
  // first chain (Hardhat 31337) until a wallet is connected.
  const { address, isConnected, chainId: walletChainId } = useAccount();
  const chainId = walletChainId;
  const isArbitrumSepolia = chainId === 421614;
  const deployment = isArbitrumSepolia ? arbitrumSepoliaDeployment : localDeployment;
  const networkLabel = isArbitrumSepolia ? "Arbitrum Sepolia" : "Hardhat Local";

  const CURE_ADDRESS = deployment.MockCURE as `0x${string}`;
  const BAO_ADDRESS = deployment.MockBAO as `0x${string}`;
  const SWAP_ADDRESS = deployment.SimpleSwap as `0x${string}`;
  const ZERO = "0x0000000000000000000000000000000000000000";
  const deployed = CURE_ADDRESS !== ZERO && SWAP_ADDRESS !== ZERO;

  console.log("[LocalSwapWidget]", { chainId, isArbitrumSepolia, CURE_ADDRESS, BAO_ADDRESS, SWAP_ADDRESS });

  const TOKENS = [
    { symbol: "CURE", name: "Mock CURE", address: CURE_ADDRESS, decimals: 18, color: "#7c3aed" },
    { symbol: "BAO",  name: "Mock BAO",  address: BAO_ADDRESS,  decimals: 18, color: "#2563eb" },
  ] as const;
  type Token = (typeof TOKENS)[number];

  const publicClient = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  // Store indices, not token objects — token objects contain addresses that change
  // when the chain switches, but useState captures the value at mount time only.
  const [fromIndex, setFromIndex] = useState(0);
  const [toIndex, setToIndex]     = useState(1);
  const fromToken = TOKENS[fromIndex];
  const toToken   = TOKENS[toIndex];
  const [inputAmount, setInputAmount] = useState("");
  const [txStatus, setTxStatus] = useState<"idle"|"approving"|"swapping"|"success"|"error">("idle");
  const [txHash, setTxHash]     = useState<string | null>(null);
  const [txError, setTxError]   = useState<string | null>(null);
  const [faucetStatus, setFaucetStatus] = useState<"idle"|"minting"|"success"|"error">("idle");
  const [faucetError, setFaucetError]   = useState<string | null>(null);

  const parsedAmount = parseFloat(inputAmount);
  const validAmount  = !isNaN(parsedAmount) && parsedAmount > 0;
  const busy = txStatus === "approving" || txStatus === "swapping";

  const { data: reserves, refetch: refetchReserves } = useReadContracts({
    contracts: [
      { address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "reserveA" },
      { address: SWAP_ADDRESS, abi: SWAP_ABI, functionName: "reserveB" },
    ],
    query: { enabled: deployed, refetchInterval: 8000 },
  });

  const reserveCURE = (reserves?.[0]?.result ?? 0n) as bigint;
  const reserveBAO  = (reserves?.[1]?.result ?? 0n) as bigint;

  const { data: allowance, refetch: refetchAllowance } = useReadContract({
    address: fromToken.address,
    abi: erc20Abi,
    functionName: "allowance",
    args: [address!, SWAP_ADDRESS],
    query: { enabled: deployed && !!address },
  });

  const { data: balances, refetch: refetchBalances } = useReadContracts({
    contracts: [
      { address: CURE_ADDRESS, abi: erc20Abi, functionName: "balanceOf", args: [address!] },
      { address: BAO_ADDRESS,  abi: erc20Abi, functionName: "balanceOf", args: [address!] },
    ],
    query: { enabled: deployed && !!address },
  });

  const cureBal = (balances?.[0]?.result ?? 0n) as bigint;
  const baoBal  = (balances?.[1]?.result ?? 0n) as bigint;

  const outputAmount: bigint | null = (() => {
    if (!validAmount) return null;
    try {
      const amountIn = parseUnits(inputAmount, fromToken.decimals);
      const [rIn, rOut] = fromToken.symbol === "CURE" ? [reserveCURE, reserveBAO] : [reserveBAO, reserveCURE];
      const out = ammAmountOut(amountIn, rIn, rOut);
      return out > 0n ? out : null;
    } catch { return null; }
  })();

  const outputFormatted = outputAmount !== null ? parseFloat(formatUnits(outputAmount, toToken.decimals)) : null;
  const rate = outputFormatted !== null && validAmount ? outputFormatted / parsedAmount : null;

  function handleFlip() {
    setFromIndex(toIndex);
    setToIndex(fromIndex);
    setInputAmount("");
    setTxStatus("idle");
    setTxError(null);
  }

  async function handleFaucet() {
    if (!address || !publicClient) return;
    setFaucetStatus("minting");
    setFaucetError(null);
    try {
      const amount = parseUnits("10000", 18);
      const tx1 = await writeContractAsync({ address: CURE_ADDRESS, abi: MINT_ABI, functionName: "mint", args: [address, amount] });
      await publicClient.waitForTransactionReceipt({ hash: tx1 });
      const tx2 = await writeContractAsync({ address: BAO_ADDRESS,  abi: MINT_ABI, functionName: "mint", args: [address, amount] });
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

  async function handleSwap() {
    if (!validAmount || !address || !publicClient || outputAmount === null) return;
    setTxHash(null);
    setTxError(null);
    try {
      const amountIn = parseUnits(inputAmount, fromToken.decimals);
      const minOut = (outputAmount * 99n) / 100n;

      if ((allowance ?? 0n) < amountIn) {
        setTxStatus("approving");
        const approveTx = await writeContractAsync({
          address: fromToken.address,
          abi: erc20Abi,
          functionName: "approve",
          args: [SWAP_ADDRESS, maxUint256],
        });
        await publicClient.waitForTransactionReceipt({ hash: approveTx });
        await refetchAllowance();
      }
      setTxStatus("swapping");
      const swapTx = await writeContractAsync({
        address: SWAP_ADDRESS,
        abi: SWAP_ABI,
        functionName: "swap",
        args: [fromToken.address, amountIn, minOut],
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

  function getButton() {
    if (!deployed)    return { label: "Contracts not deployed", disabled: true };
    if (!isConnected) return { label: "Connect Wallet", disabled: true };
    if (!validAmount) return { label: "Enter Amount", disabled: true };
    if (reserveCURE === 0n && reserveBAO === 0n) return { label: "Pool has no liquidity", disabled: true };
    if (outputAmount === null) return { label: "Insufficient liquidity", disabled: true };
    if (txStatus === "approving") return { label: "Approving…", disabled: true };
    if (txStatus === "swapping")  return { label: "Swapping…", disabled: true };
    return { label: `Swap ${fromToken.symbol} → ${toToken.symbol}`, disabled: false, onClick: handleSwap };
  }

  const btn = getButton();

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      <div className="flex justify-end"><ConnectButton /></div>
      <div className="rounded-2xl border border-slate-700 bg-[#111827] p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Swap</h2>
          <span className="text-xs text-green-400 bg-green-400/10 border border-green-400/20 px-2 py-1 rounded-full">
            ⬡ {networkLabel}
          </span>
        </div>

        {deployed && (reserveCURE > 0n || reserveBAO > 0n) && (
          <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-2 flex justify-between text-xs text-slate-500">
            <span>Pool: {parseFloat(formatUnits(reserveCURE, 18)).toLocaleString()} CURE</span>
            <span>{parseFloat(formatUnits(reserveBAO, 18)).toLocaleString()} BAO</span>
          </div>
        )}

        {isConnected && deployed && (
          <div className="rounded-lg bg-slate-800/60 border border-slate-700/40 px-3 py-2 flex items-center justify-between gap-2">
            <div className="text-xs text-slate-500 flex gap-3">
              <span>{parseFloat(formatUnits(cureBal, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} CURE</span>
              <span>{parseFloat(formatUnits(baoBal, 18)).toLocaleString(undefined, { maximumFractionDigits: 2 })} BAO</span>
            </div>
            <button
              onClick={handleFaucet}
              disabled={faucetStatus === "minting"}
              className="text-xs px-2 py-1 rounded-md border border-slate-600 bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-40 transition-colors">
              {faucetStatus === "minting" ? "Minting…" : faucetStatus === "success" ? "Minted!" : "Get test tokens"}
            </button>
          </div>
        )}

        {faucetStatus === "error" && faucetError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">{faucetError}</div>
        )}

        <div className="flex flex-col gap-3">
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">From</label>
            <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3">
              <TokenAvatar symbol={fromToken.symbol} color={fromToken.color} size={22} />
              <span className="text-white text-sm">{fromToken.symbol}</span>
            </div>
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Amount</label>
            <input type="number" min="0" step="any" placeholder="0.0" value={inputAmount}
              onChange={(e) => { setInputAmount(e.target.value); setTxStatus("idle"); setTxError(null); }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500 disabled:opacity-50" />
          </div>
        </div>

        <div className="flex justify-center">
          <button onClick={handleFlip} disabled={busy}
            className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-40">
            ⇅
          </button>
        </div>

        <div className="flex flex-col gap-1">
          <label className="text-xs text-slate-500 font-medium">To (estimated)</label>
          <div className="flex items-center gap-2 rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3">
            <TokenAvatar symbol={toToken.symbol} color={toToken.color} size={22} />
            <span className="text-white text-sm">{toToken.symbol}</span>
          </div>
        </div>

        {outputFormatted !== null && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">You receive</span>
              <span className="text-lg font-semibold text-white">
                {outputFormatted < 0.0001 ? outputFormatted.toExponential(4) : outputFormatted.toLocaleString(undefined, { maximumFractionDigits: 6 })} <span className="text-purple-400">{toToken.symbol}</span>
              </span>
            </div>
            <div className="h-px bg-slate-700/60" />
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

        {txStatus === "error" && txError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">{txError}</div>
        )}

        <button disabled={btn.disabled || busy} onClick={btn.onClick}
          className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2">
          {busy && <svg className="animate-spin h-4 w-4" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24"><circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" /><path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" /></svg>}
          {btn.label}
        </button>

        <p className="text-center text-xs text-slate-600">SimpleSwap AMM · {networkLabel} (chainId {chainId})</p>
      </div>
    </div>
  );
}
