"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { ConnectButton } from "@rainbow-me/rainbowkit";
import { useAccount, usePublicClient, useWriteContract } from "wagmi";
import { parseEventLogs } from "viem";
import { FACTORY_ADDRESS, FACTORY_ABI } from "@/lib/meme-abis";

const CLOUDINARY_URL    = "https://api.cloudinary.com/v1_1/dzrmc3fe4/image/upload";
const CLOUDINARY_PRESET = "xcuretest";
const MAX_FILE_BYTES    = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES     = ["image/jpeg", "image/png", "image/gif", "image/webp"];

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

  // Image upload state
  const [uploadStatus, setUploadStatus] = useState<"idle" | "uploading" | "done" | "error">("idle");
  const [uploadError,  setUploadError]  = useState<string | null>(null);
  const [dragOver,     setDragOver]     = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function uploadToCloudinary(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      setUploadError("Only JPG, PNG, GIF, WEBP allowed");
      setUploadStatus("error");
      return;
    }
    if (file.size > MAX_FILE_BYTES) {
      setUploadError("File must be under 5 MB");
      setUploadStatus("error");
      return;
    }
    setUploadStatus("uploading");
    setUploadError(null);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("upload_preset", CLOUDINARY_PRESET);
      const res = await fetch(CLOUDINARY_URL, { method: "POST", body: form });
      if (!res.ok) throw new Error(`Cloudinary error ${res.status}`);
      const data = await res.json();
      setImageURI(data.secure_url);
      setUploadStatus("done");
    } catch (e: unknown) {
      const msg = e instanceof Error ? e.message : "Upload failed";
      setUploadError(msg);
      setUploadStatus("error");
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) uploadToCloudinary(file);
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file) uploadToCloudinary(file);
  }

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

            {/* Image Upload */}
            <div>
              <label className="block text-xs text-slate-400 mb-1.5 font-medium">Image</label>

              {uploadStatus === "done" && imageURI ? (
                // Preview after successful upload
                <div className="flex items-center gap-3">
                  <img
                    src={imageURI}
                    alt="preview"
                    className="w-20 h-20 rounded-xl object-cover border border-slate-700 flex-shrink-0"
                  />
                  <button
                    type="button"
                    onClick={() => { setImageURI(""); setUploadStatus("idle"); setUploadError(null); if (fileInputRef.current) fileInputRef.current.value = ""; }}
                    className="text-xs text-slate-400 hover:text-red-400 transition-colors"
                  >
                    Remove
                  </button>
                </div>
              ) : (
                // Drop zone
                <div
                  onClick={() => !busy && fileInputRef.current?.click()}
                  onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={handleDrop}
                  className={[
                    "relative flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed py-8 px-4 cursor-pointer transition-colors select-none",
                    dragOver
                      ? "border-purple-500 bg-purple-500/10"
                      : "border-slate-700 bg-slate-900 hover:border-purple-500/60 hover:bg-slate-900/80",
                    busy ? "opacity-50 pointer-events-none" : "",
                  ].join(" ")}
                >
                  {uploadStatus === "uploading" ? (
                    <>
                      <Spinner />
                      <span className="text-xs text-slate-400">Uploading…</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-8 h-8 text-slate-600" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M4 16l4-4m0 0l4 4m-4-4v9M20 16l-4-4m0 0l-4 4m4-4V9M12 3v6" />
                      </svg>
                      <span className="text-xs text-slate-400">Click or drag to upload</span>
                      <span className="text-[11px] text-slate-600">JPG · PNG · GIF · WEBP · max 5 MB</span>
                    </>
                  )}
                </div>
              )}

              <input
                ref={fileInputRef}
                type="file"
                accept="image/jpeg,image/png,image/gif,image/webp"
                className="hidden"
                onChange={handleFileChange}
              />

              {uploadStatus === "error" && uploadError && (
                <p className="mt-1.5 text-xs text-red-400">{uploadError}</p>
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
