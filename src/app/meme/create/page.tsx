"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseEventLogs } from "viem";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/meme-abis";

export default function CreatePage() {
  const router = useRouter();
  const { isConnected } = useAccount();
  const publicClient    = usePublicClient();
  const { writeContractAsync } = useWriteContract();

  const [name,        setName]        = useState("");
  const [symbol,      setSymbol]      = useState("");
  const [imageURI,    setImageURI]    = useState("");
  const [description, setDescription] = useState("");
  const [status, setStatus] = useState<"idle" | "pending" | "error">("idle");
  const [error,  setError]  = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isConnected || !publicClient) return;

    setStatus("pending");
    setError(null);
    try {
      const fees = await publicClient.estimateFeesPerGas();
      const hash = await writeContractAsync({
        address: FACTORY_ADDRESS,
        abi: FACTORY_ABI,
        functionName: "createToken",
        args: [name.trim(), symbol.trim().toUpperCase()],
        maxFeePerGas:         fees.maxFeePerGas,
        maxPriorityFeePerGas: fees.maxPriorityFeePerGas,
      });

      const receipt = await publicClient.waitForTransactionReceipt({ hash });

      // Parse TokenCreated event to extract the new token address
      const logs = parseEventLogs({ abi: FACTORY_ABI, logs: receipt.logs });
      const evt  = logs.find((l) => l.eventName === "TokenCreated");
      if (!evt) throw new Error("TokenCreated event not found in receipt");

      const tokenAddr = (evt.args as { token: `0x${string}` }).token;

      // Persist optional metadata locally (imageURI + description not stored on-chain)
      if (imageURI || description) {
        try {
          localStorage.setItem(
            `meme:${tokenAddr}`,
            JSON.stringify({ imageURI, description }),
          );
        } catch {}
      }

      router.push(`/meme/${tokenAddr}`);
    } catch (e: unknown) {
      const err = e as { shortMessage?: string; message?: string };
      const msg = err.shortMessage ?? err.message ?? "Transaction failed";
      if (!msg.toLowerCase().includes("rejected") && !msg.toLowerCase().includes("denied")) {
        setError(msg);
      }
      setStatus("error");
    }
  }

  const busy = status === "pending";

  return (
    <div className="min-h-screen bg-[#111827] text-white p-6">
      <div className="max-w-lg mx-auto">

        {/* Nav */}
        <div className="flex items-center justify-between mb-8">
          <Link href="/meme" className="text-slate-400 hover:text-white text-sm transition-colors">
            ← All Tokens
          </Link>
          <ConnectButton />
        </div>

        <div className="rounded-2xl border border-slate-700 bg-slate-800/40 p-6 flex flex-col gap-6">
          <div>
            <h1 className="text-xl font-bold">Launch a Token</h1>
            <p className="text-slate-400 text-sm mt-1">
              Deploys a bonding curve on Arbitrum Sepolia. You receive{" "}
              <span className="text-purple-400 font-semibold">200M tokens (20%)</span> as creator.
            </p>
          </div>

          <form onSubmit={handleSubmit} className="flex flex-col gap-4">
            {/* Name */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Token Name <span className="text-red-400">*</span>
              </label>
              <input
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                disabled={busy}
                placeholder="e.g. Pepe Cure"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
              />
            </div>

            {/* Symbol */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">
                Symbol <span className="text-red-400">*</span>
              </label>
              <input
                value={symbol}
                onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                required
                disabled={busy}
                maxLength={8}
                placeholder="e.g. PEPE"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500 focus:ring-1 focus:ring-purple-500/50 disabled:opacity-50"
              />
            </div>

            {/* Divider */}
            <div className="flex items-center gap-3">
              <div className="flex-1 h-px bg-slate-700/60" />
              <span className="text-xs text-slate-500">Optional metadata (saved locally)</span>
              <div className="flex-1 h-px bg-slate-700/60" />
            </div>

            {/* Image URI */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Image URL</label>
              <input
                value={imageURI}
                onChange={(e) => setImageURI(e.target.value)}
                disabled={busy}
                placeholder="https://…"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500 disabled:opacity-50"
              />
              {imageURI && (
                <img
                  src={imageURI}
                  alt="preview"
                  className="mt-2 w-16 h-16 rounded-xl object-cover border border-slate-700"
                />
              )}
            </div>

            {/* Description */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Description</label>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={busy}
                rows={3}
                placeholder="What's this token about?"
                className="w-full rounded-lg border border-slate-700 bg-slate-900 px-4 py-2.5 text-sm placeholder-slate-600 focus:outline-none focus:border-purple-500 resize-none disabled:opacity-50"
              />
            </div>

            {/* Error */}
            {status === "error" && error && (
              <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-2.5 text-xs text-red-400 break-words">
                {error}
              </div>
            )}

            {/* Submit */}
            <button
              type="submit"
              disabled={!isConnected || busy || !name || !symbol}
              className="w-full rounded-xl bg-purple-600 hover:bg-purple-500 disabled:opacity-40 disabled:cursor-not-allowed py-3 text-sm font-semibold transition-colors flex items-center justify-center gap-2"
            >
              {busy && <Spinner />}
              {busy
                ? "Deploying…"
                : !isConnected
                ? "Connect Wallet to Launch"
                : "🚀 Launch Token"}
            </button>
          </form>

          {/* Info box */}
          <div className="rounded-xl border border-slate-700/40 bg-slate-900/40 px-4 py-3 text-xs text-slate-500 flex flex-col gap-1">
            <p>• Linear bonding curve — price rises as more tokens are bought</p>
            <p>• Graduates to free trading when 0.1 ETH is raised</p>
            <p>• 1% fee on every buy and sell</p>
            <p>• Image & description are stored in your browser only</p>
          </div>
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
