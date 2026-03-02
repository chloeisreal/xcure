"use client";

import { useState, useEffect } from "react";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount } from "wagmi";

const TOKENS = [
  { symbol: "VITA", name: "VitaDAO", color: "#7c3aed", price: 0.32 },
  { symbol: "BIO", name: "BIO Protocol", color: "#2563eb", price: 0.85 },
  { symbol: "GROW", name: "Grow Finance", color: "#16a34a", price: 0.12 },
  { symbol: "ETH", name: "Ethereum", color: "#6366f1", price: 3200 },
  { symbol: "USDC", name: "USD Coin", color: "#0ea5e9", price: 1.0 },
];

type Token = (typeof TOKENS)[number];

function TokenAvatar({ token, size = 28 }: { token: Token; size?: number }) {
  return (
    <span
      className="rounded-full flex items-center justify-center text-white font-bold shrink-0"
      style={{
        width: size,
        height: size,
        fontSize: size * 0.36,
        background: token.color,
      }}
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

function getMockQuote(
  from: Token,
  to: Token,
  amount: number
): { output: number; rate: number; priceImpact: number; fee: number } {
  const output = (amount * from.price) / to.price;
  const rate = from.price / to.price;
  const priceImpact = Math.min(0.05 + amount * 0.001, 3.0); // mock impact grows with size
  const fee = amount * from.price * 0.003; // 0.3% fee in USD
  return { output, rate, priceImpact, fee };
}

export default function SwapWidget() {
  const { isConnected } = useAccount();

  const [fromToken, setFromToken] = useState<Token | null>(TOKENS[0]); // VITA
  const [toToken, setToToken] = useState<Token | null>(TOKENS[3]); // ETH
  const [inputAmount, setInputAmount] = useState("");
  const [quote, setQuote] = useState<ReturnType<typeof getMockQuote> | null>(null);

  const amount = parseFloat(inputAmount);
  const validAmount = !isNaN(amount) && amount > 0;

  // Recalculate quote whenever inputs change
  useEffect(() => {
    if (fromToken && toToken && validAmount) {
      setQuote(getMockQuote(fromToken, toToken, amount));
    } else {
      setQuote(null);
    }
  }, [fromToken, toToken, inputAmount]); // eslint-disable-line

  function handleFlip() {
    setFromToken(toToken);
    setToToken(fromToken);
    setInputAmount("");
    setQuote(null);
  }

  function getButtonState() {
    if (!isConnected) return { label: "Connect Wallet", disabled: true };
    if (!fromToken || !toToken) return { label: "Select Tokens", disabled: true };
    if (!validAmount) return { label: "Enter Amount", disabled: true };
    return { label: "Swap", disabled: false };
  }

  const btn = getButtonState();

  return (
    <div className="w-full max-w-md mx-auto flex flex-col gap-4">
      {/* Connect button */}
      <div className="flex justify-end">
        <ConnectButton />
      </div>

      {/* Card */}
      <div className="rounded-2xl border border-slate-700 bg-[#111827] p-6 flex flex-col gap-5">
        <h2 className="text-lg font-semibold text-white">Swap</h2>

        {/* From */}
        <div className="flex flex-col gap-3">
          <TokenSelect
            label="From"
            value={fromToken}
            onChange={setFromToken}
            exclude={toToken}
          />
          <div className="flex flex-col gap-1">
            <label className="text-xs text-slate-500 font-medium">Amount</label>
            <input
              type="number"
              min="0"
              placeholder="0.0"
              value={inputAmount}
              onChange={(e) => setInputAmount(e.target.value)}
              className="w-full rounded-lg border border-slate-700 bg-slate-800/80 px-4 py-3 text-white text-sm placeholder-slate-600 focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
            />
            {fromToken && validAmount && (
              <p className="text-xs text-slate-600 text-right">
                ≈ ${(amount * fromToken.price).toFixed(2)} USD
              </p>
            )}
          </div>
        </div>

        {/* Flip button */}
        <div className="flex justify-center">
          <button
            onClick={handleFlip}
            className="w-9 h-9 rounded-full border border-slate-700 bg-slate-800 hover:bg-slate-700 flex items-center justify-center text-slate-400 hover:text-white transition-colors"
            title="Flip tokens"
          >
            ⇅
          </button>
        </div>

        {/* To */}
        <TokenSelect
          label="To (estimated)"
          value={toToken}
          onChange={setToToken}
          exclude={fromToken}
        />

        {/* Quote output */}
        {quote && toToken ? (
          <div className="rounded-xl border border-slate-700/60 bg-slate-800/40 px-4 py-3 flex flex-col gap-2">
            <div className="flex justify-between items-center">
              <span className="text-sm text-slate-400">You receive</span>
              <span className="text-lg font-semibold text-white">
                {quote.output < 0.0001
                  ? quote.output.toExponential(4)
                  : quote.output.toLocaleString(undefined, { maximumFractionDigits: 6 })}{" "}
                <span className="text-blue-400">{toToken.symbol}</span>
              </span>
            </div>
            <div className="h-px bg-slate-700/60" />
            <div className="flex justify-between text-xs text-slate-500">
              <span>Rate</span>
              <span>
                1 {fromToken?.symbol} = {quote.rate < 0.001 ? quote.rate.toExponential(4) : quote.rate.toFixed(6)} {toToken.symbol}
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Price impact</span>
              <span className={quote.priceImpact > 1 ? "text-amber-400" : "text-green-400"}>
                {quote.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-xs text-slate-500">
              <span>Fee (0.3%)</span>
              <span>${quote.fee.toFixed(4)}</span>
            </div>
          </div>
        ) : (
          fromToken && toToken && !validAmount && (
            <div className="rounded-xl border border-slate-700/40 bg-slate-800/20 px-4 py-3 text-xs text-slate-600 text-center">
              Enter an amount to see the quote
            </div>
          )
        )}

        {/* Swap button */}
        <button
          disabled={btn.disabled}
          className="w-full rounded-xl bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed py-3.5 text-sm font-semibold text-white transition-colors"
        >
          {btn.label}
        </button>

        <p className="text-center text-xs text-slate-600">
          Mock quotes only — no real trades executed
        </p>
      </div>
    </div>
  );
}
