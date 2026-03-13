"use client";

import { useState, useEffect, useRef } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import {
  useAccount,
  useChainId,
  usePublicClient,
  useSendTransaction,
  useSignTypedData,
  useWriteContract,
  useSwitchChain,
} from "wagmi";
import { formatUnits, parseUnits, maxUint256, erc20Abi } from "viem";
import { arbitrumSepolia } from "wagmi/chains";

// Permit2 universal contract address (same on all EVM chains)
const PERMIT2 = "0x000000000022D473030F116dDEE9F6B43aC78BA3" as `0x${string}`;
// Sentinel address for native ETH in 0x API
const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEEE";

// Target wallet chain: Arbitrum Sepolia (testnet)
const WALLET_CHAIN_ID = arbitrumSepolia.id;

// Token list — addresses are on Arbitrum One (used for 0x price quotes).
// VITA and BIO may have limited liquidity on Arbitrum; update addresses as needed.
const TOKENS = [
  {
    symbol: "ETH",
    name: "Ethereum",
    address: NATIVE,
    decimals: 18,
    color: "#6366f1",
  },
  {
    symbol: "USDC",
    name: "USD Coin",
    // Native USDC on Arbitrum One
    address: "0xaf88d065e77c8cC2239327C5EDb3A432268e5831",
    decimals: 6,
    color: "#0ea5e9",
  },
  {
    symbol: "VITA",
    name: "VitaDAO",
    // VitaDAO token (Ethereum mainnet; bridged Arbitrum address if available)
    address: "0x81f8f0bb1cB2A06649E51913A151F0E7Ef6FA321",
    decimals: 18,
    color: "#7c3aed",
  },
  {
    symbol: "BIO",
    name: "BIO Protocol",
    // Update this to the Arbitrum One BIO token address when available
    address: "0xcb1592591996765Ec0eFa0b776Da702c9D6c4a0e",
    decimals: 18,
    color: "#2563eb",
  },
] as const;

type Token = (typeof TOKENS)[number];
type TxStatus = "idle" | "approving" | "signing" | "swapping" | "success" | "error";

// Fetch price estimate (no taker required — safe for unauthenticated display)
async function fetchPriceQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ type: "price", sellToken, buyToken, sellAmount });
  const res = await fetch(`/api/swap/quote?${params}`);
  const data = await res.json();
  if (!res.ok) {
    const msg =
      (data as any).validationErrors?.[0]?.reason ??
      (data as any).reason ??
      "Failed to fetch price";
    throw new Error(msg);
  }
  return data;
}

// Fetch full swap quote including transaction calldata (requires taker address)
async function fetchSwapQuote(
  sellToken: string,
  buyToken: string,
  sellAmount: string,
  taker: string
): Promise<Record<string, unknown>> {
  const params = new URLSearchParams({ type: "quote", sellToken, buyToken, sellAmount, taker });
  const res = await fetch(`/api/swap/quote?${params}`);
  const data = await res.json();
  if (!res.ok) {
    const msg =
      (data as any).validationErrors?.[0]?.reason ??
      (data as any).reason ??
      "Failed to fetch quote";
    throw new Error(msg);
  }
  return data;
}

function TokenAvatar({ token, size = 28 }: { token: Token; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{ width: size, height: size, fontSize: size * 0.36, background: token.color }}
    >
      {token.symbol[0]}
    </span>
  );
}

function TokenSelect({
  value,
  onChange,
  exclude,
  label,
}: {
  value: Token | null;
  onChange: (t: Token) => void;
  exclude: Token | null;
  label: string;
}) {
  const options = TOKENS.filter((t) => t.symbol !== exclude?.symbol);
  return (
    <div className="flex flex-col gap-1">
      <label className="text-xs text-slate-500 font-medium">{label}</label>
      <div className="relative">
        <select
          value={value?.symbol ?? ""}
          onChange={(e) => {
            const t = TOKENS.find((t) => t.symbol === e.target.value);
            if (t) onChange(t);
          }}
          className="w-full appearance-none rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 pl-11 text-white text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 cursor-pointer"
        >
          <option value="" disabled>
            Select token
          </option>
          {options.map((t) => (
            <option key={t.symbol} value={t.symbol}>
              {t.symbol} — {t.name}
            </option>
          ))}
        </select>
        {value && (
          <div className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2">
            <TokenAvatar token={value} size={22} />
          </div>
        )}
        <div className="pointer-events-none absolute right-3 top-1/2 -translate-y-1/2 text-slate-500">
          ▾
        </div>
      </div>
    </div>
  );
}

export default function SwapWidget() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const publicClient = usePublicClient();
  const { sendTransactionAsync } = useSendTransaction();
  const { signTypedDataAsync } = useSignTypedData();
  const { writeContractAsync } = useWriteContract();
  const { switchChain } = useSwitchChain();

  const [fromToken, setFromToken] = useState<Token | null>(TOKENS[0]); // ETH
  const [toToken, setToToken] = useState<Token | null>(TOKENS[1]); // USDC
  const [inputAmount, setInputAmount] = useState("");

  const [priceQuote, setPriceQuote] = useState<Record<string, unknown> | null>(null);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [quoteError, setQuoteError] = useState<string | null>(null);

  const [txStatus, setTxStatus] = useState<TxStatus>("idle");
  const [txHash, setTxHash] = useState<string | null>(null);
  const [txError, setTxError] = useState<string | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const parsedAmount = parseFloat(inputAmount);
  const validAmount = !isNaN(parsedAmount) && parsedAmount > 0;
  const wrongChain = isConnected && chainId !== WALLET_CHAIN_ID;
  const busy = txStatus === "approving" || txStatus === "signing" || txStatus === "swapping";

  // Auto-fetch price quote (debounced, 600 ms)
  useEffect(() => {
    if (!fromToken || !toToken || !validAmount) {
      setPriceQuote(null);
      setQuoteError(null);
      return;
    }

    if (debounceRef.current) clearTimeout(debounceRef.current);
    setQuoteLoading(true);
    setQuoteError(null);
    setPriceQuote(null);

    debounceRef.current = setTimeout(async () => {
      try {
        let sellAmount: string;
        try {
          sellAmount = parseUnits(inputAmount, fromToken.decimals).toString();
        } catch {
          throw new Error("Invalid amount");
        }
        const data = await fetchPriceQuote(fromToken.address, toToken.address, sellAmount);
        setPriceQuote(data);
      } catch (e: unknown) {
        setQuoteError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setQuoteLoading(false);
      }
    }, 600);

    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [fromToken, toToken, inputAmount]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleFlip() {
    setFromToken(toToken);
    setToToken(fromToken);
    setInputAmount("");
    setPriceQuote(null);
    setQuoteError(null);
    setTxStatus("idle");
    setTxError(null);
  }

  function resetInput() {
    setFromToken((t) => t);
    setTxStatus("idle");
    setTxError(null);
  }

  async function handleSwap() {
    if (!fromToken || !toToken || !validAmount || !address || !publicClient) return;

    setTxHash(null);
    setTxError(null);

    try {
      let sellAmount: string;
      try {
        sellAmount = parseUnits(inputAmount, fromToken.decimals).toString();
      } catch {
        throw new Error("Invalid amount");
      }

      // 1. Fetch full quote with transaction calldata
      setTxStatus("signing");
      let quote = await fetchSwapQuote(fromToken.address, toToken.address, sellAmount, address);

      // 2. Approve Permit2 contract to spend the sell token if needed
      const issues = quote.issues as { allowance?: { spender: string } } | undefined;
      if (issues?.allowance && fromToken.address !== NATIVE) {
        setTxStatus("approving");
        const approveTxHash = await writeContractAsync({
          address: fromToken.address as `0x${string}`,
          abi: erc20Abi,
          functionName: "approve",
          args: [PERMIT2, maxUint256],
        });
        // Wait for approval to be mined before re-fetching quote
        await publicClient.waitForTransactionReceipt({ hash: approveTxHash });

        // Re-fetch quote now that approval is confirmed
        setTxStatus("signing");
        quote = await fetchSwapQuote(fromToken.address, toToken.address, sellAmount, address);
      }

      // 3. Sign Permit2 EIP-712 message if the quote requires it
      const permit2 = quote.permit2 as
        | { eip712: { types: Record<string, unknown>; domain: Record<string, unknown>; message: Record<string, unknown>; primaryType: string } }
        | undefined;

      const txn = quote.transaction as {
        to: string;
        data: string;
        value: string;
        gas: string;
      };

      let txData: `0x${string}` = txn.data as `0x${string}`;

      if (permit2?.eip712) {
        const { types, domain, message, primaryType } = permit2.eip712;
        // Exclude EIP712Domain from types — wagmi derives it from domain
        const { EIP712Domain: _ignored, ...filteredTypes } = types as Record<string, unknown>;

        const signature = await signTypedDataAsync({
          domain: domain as Parameters<typeof signTypedDataAsync>[0]["domain"],
          types: filteredTypes as Parameters<typeof signTypedDataAsync>[0]["types"],
          primaryType,
          message: message as Record<string, unknown>,
        });

        // Append the signature bytes to the calldata (0x API v2 Permit2 pattern)
        txData = (txn.data + signature.slice(2)) as `0x${string}`;
      }

      // 4. Send the swap transaction
      setTxStatus("swapping");
      const hash = await sendTransactionAsync({
        to: txn.to as `0x${string}`,
        data: txData,
        value: BigInt(txn.value || "0"),
        gas: BigInt(txn.gas),
      });

      setTxHash(hash);
      setTxStatus("success");
      setInputAmount("");
      setPriceQuote(null);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Transaction failed";
      // User rejected is not really an error worth showing prominently
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) {
        setTxError(msg);
      }
      setTxStatus("error");
    }
  }

  // Derived display values from the price quote
  const outputAmount =
    priceQuote && toToken
      ? parseFloat(formatUnits(BigInt(priceQuote.buyAmount as string), toToken.decimals))
      : null;

  const rate =
    priceQuote && fromToken && toToken
      ? parseFloat(formatUnits(BigInt(priceQuote.buyAmount as string), toToken.decimals)) /
        parseFloat(formatUnits(BigInt(priceQuote.sellAmount as string), fromToken.decimals))
      : null;

  function getButton(): { label: string; disabled: boolean; onClick?: () => void } {
    if (!isConnected) return { label: "Connect Wallet", disabled: true };
    if (wrongChain)
      return {
        label: "Switch to Arbitrum Sepolia",
        disabled: false,
        onClick: () => switchChain({ chainId: WALLET_CHAIN_ID }),
      };
    if (!fromToken || !toToken) return { label: "Select Tokens", disabled: true };
    if (!validAmount) return { label: "Enter Amount", disabled: true };
    if (quoteLoading) return { label: "Fetching price…", disabled: true };
    if (quoteError) return { label: "No route found", disabled: true };
    if (!priceQuote) return { label: "Enter Amount", disabled: true };
    if (txStatus === "approving") return { label: "Approving token…", disabled: true };
    if (txStatus === "signing") return { label: "Sign in wallet…", disabled: true };
    if (txStatus === "swapping") return { label: "Confirming swap…", disabled: true };
    return {
      label: `Swap ${fromToken.symbol} → ${toToken.symbol}`,
      disabled: false,
      onClick: handleSwap,
    };
  }

  const btn = getButton();

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      {/* Wallet connect button */}
      <div className="flex justify-end">
        <ConnectButton />
      </div>

      {/* Main swap card */}
      <div className="rounded-2xl border border-slate-700 bg-[#111827] p-6 flex flex-col gap-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-white">Swap</h2>
          <span className="text-xs text-slate-500 bg-slate-800 px-2 py-1 rounded-full">
            via 0x Protocol
          </span>
        </div>

        {/* Wrong-chain warning */}
        {wrongChain && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/30 px-3 py-2 text-xs text-amber-400">
            Wrong network detected. Please switch to Arbitrum Sepolia.
          </div>
        )}

        {/* Testnet notice */}
        {isConnected && !wrongChain && (
          <div className="rounded-lg bg-blue-500/10 border border-blue-500/20 px-3 py-2 text-xs text-blue-400">
            Connected to Arbitrum Sepolia (testnet). Prices reference Arbitrum One via 0x API.
          </div>
        )}

        {/* From section */}
        <div className="flex flex-col gap-3">
          <TokenSelect
            label="From"
            value={fromToken}
            onChange={(t) => { setFromToken(t); resetInput(); }}
            exclude={toToken}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Amount</label>
            <input
              type="number"
              min="0"
              step="any"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => { setInputAmount(e.target.value); setTxStatus("idle"); setTxError(null); }}
              disabled={busy}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 disabled:opacity-50"
            />
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            onClick={handleFlip}
            disabled={busy}
            className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors disabled:opacity-40"
            title="Flip tokens"
          >
            ⇅
          </button>
        </div>

        {/* To section */}
        <TokenSelect
          label="To (estimated)"
          value={toToken}
          onChange={(t) => { setToToken(t); resetInput(); }}
          exclude={fromToken}
        />

        {/* Quote loading */}
        {quoteLoading && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 px-4 py-3 text-xs text-slate-500 text-center animate-pulse">
            Fetching best price from 0x…
          </div>
        )}

        {/* Quote error */}
        {!quoteLoading && quoteError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400">
            {quoteError}
          </div>
        )}

        {/* Quote result */}
        {!quoteLoading && !quoteError && priceQuote && outputAmount !== null && toToken && (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">You receive</span>
              <span className="text-lg font-semibold text-white">
                {outputAmount < 0.0001
                  ? outputAmount.toExponential(4)
                  : outputAmount.toLocaleString(undefined, { maximumFractionDigits: 6 })}
                {" "}
                <span className="text-blue-400">{toToken.symbol}</span>
              </span>
            </div>
            <div className="h-px bg-slate-700/60" />
            {rate !== null && fromToken && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>Rate</span>
                <span>
                  1 {fromToken.symbol} ≈{" "}
                  {rate < 0.001 ? rate.toExponential(4) : rate.toFixed(6)}{" "}
                  {toToken.symbol}
                </span>
              </div>
            )}
            {priceQuote.fees && !!(priceQuote.fees as Record<string, unknown>).zeroExFee && (
              <div className="flex justify-between text-xs text-slate-500">
                <span>0x fee</span>
                <span>
                  {formatUnits(
                    BigInt(
                      ((priceQuote.fees as Record<string, unknown>).zeroExFee as { amount: string })
                        .amount ?? "0"
                    ),
                    toToken.decimals
                  )}{" "}
                  {toToken.symbol}
                </span>
              </div>
            )}
            <div className="flex justify-between text-xs text-slate-500">
              <span>Source</span>
              <span>0x Protocol · Arbitrum One</span>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!quoteLoading && !quoteError && !priceQuote && fromToken && toToken && !validAmount && (
          <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 px-4 py-3 text-xs text-slate-600 text-center">
            Enter an amount to see the quote
          </div>
        )}

        {/* Transaction success */}
        {txStatus === "success" && txHash && (
          <div className="rounded-xl border border-green-500/30 bg-green-500/10 px-4 py-3 text-xs text-green-400 flex flex-col gap-1">
            <span className="font-semibold">Swap submitted!</span>
            <a
              href={`https://arbiscan.io/tx/${txHash}`}
              target="_blank"
              rel="noreferrer"
              className="underline text-green-300 break-all"
            >
              {txHash.slice(0, 22)}…{txHash.slice(-8)}
            </a>
          </div>
        )}

        {/* Transaction error */}
        {txStatus === "error" && txError && (
          <div className="rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-xs text-red-400 break-words">
            {txError}
          </div>
        )}

        {/* Action button */}
        <button
          disabled={btn.disabled || busy}
          onClick={btn.onClick}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white transition-colors flex items-center justify-center gap-2"
        >
          {busy && (
            <svg
              className="animate-spin h-4 w-4"
              xmlns="http://www.w3.org/2000/svg"
              fill="none"
              viewBox="0 0 24 24"
            >
              <circle
                className="opacity-25"
                cx="12"
                cy="12"
                r="10"
                stroke="currentColor"
                strokeWidth="4"
              />
              <path
                className="opacity-75"
                fill="currentColor"
                d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
              />
            </svg>
          )}
          {btn.label}
        </button>

        <p className="text-center text-xs text-slate-600">
          Powered by 0x Protocol · Arbitrum Sepolia Testnet
        </p>
      </div>
    </div>
  );
}
