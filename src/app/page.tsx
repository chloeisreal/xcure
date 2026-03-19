"use client";

import { useState, useRef } from "react";
import Link from "next/link";
import SearchForm from "@/components/SearchForm";
import AnalysisReport from "@/components/AnalysisReport";
import ValuationReport from "@/components/ValuationReport";
import NotFoundState from "@/components/NotFoundState";
import { useValuation, detectCompanyType, extractSymbol, resolveCompanyName } from "@/lib/valuation-client";

type Mode = "analysis" | "valuation";

function isNotFoundError(error: string): boolean {
  const lower = error.toLowerCase();
  return (
    lower.includes("not found") ||
    lower.includes("company not found") ||
    lower.includes("not_found") ||
    lower.includes("no data") ||
    lower.includes("symbol not found")
  );
}

const FEATURE_CARDS = [
  {
    icon: "🧬",
    title: "AI Research",
    desc: "Gemini-powered deep dives on biotech projects, pipelines, and DeSci tokens.",
    href: "#ai-tool",
    accent: "from-purple-500/20 to-purple-500/5",
    border: "border-purple-500/30",
    tag: "Live",
  },
  {
    icon: "🔄",
    title: "Swap",
    desc: "CURE ↔ BAO ↔ WETH on a constant-product AMM. Zero slippage surprise.",
    href: "/swap",
    accent: "from-blue-500/20 to-blue-500/5",
    border: "border-blue-500/30",
    tag: "Live",
  },
  {
    icon: "🚀",
    title: "Meme Launch",
    desc: "Launch biotech meme coins with a bonding curve. Price rises as the curve fills.",
    href: "/meme",
    accent: "from-green-500/20 to-green-500/5",
    border: "border-green-500/30",
    tag: "Live",
  },
  {
    icon: "📊",
    title: "Tokenomics",
    desc: "$CURE token design — supply, allocation, and the DeSci thesis behind it.",
    href: "/tokenomics",
    accent: "from-amber-500/20 to-amber-500/5",
    border: "border-amber-500/30",
    tag: "Docs",
  },
];

const STATS = [
  { label: "Network",       value: "Arbitrum Sepolia" },
  { label: "AI Model",      value: "Gemini" },
  { label: "Token Supply",  value: "1,000,000,000 $CURE" },
  { label: "VC Allocation", value: "0%" },
];

export default function Home() {
  const aiToolRef = useRef<HTMLElement>(null);

  const [mode, setMode] = useState<Mode>("analysis");
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<"HIT" | "MISS" | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const { getValuation, loading: valuationLoading, result: valuationResult } = useValuation();

  async function handleAnalyze(query: string) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setStreamedText("");
    setCurrentQuery(query);
    setError(null);
    setIsStreaming(true);

    try {
      const res = await fetch("/api/analyze", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query }),
        signal: controller.signal,
      });

      const cacheHeader = res.headers.get("X-Cache");
      if (cacheHeader) setCacheStatus(cacheHeader as "HIT" | "MISS");

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Unknown error" }));
        throw new Error(err.error ?? `HTTP ${res.status}`);
      }

      const reader = res.body!.getReader();
      const decoder = new TextDecoder();

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        setStreamedText((prev) => prev + decoder.decode(value, { stream: true }));
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setIsStreaming(false);
    }
  }

  async function handleValuation(query: string) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCurrentQuery(query);
    setError(null);
    setStreamedText("");

    try {
      const resolved = await resolveCompanyName(query);
      const symbol = resolved?.symbol || extractSymbol(query);
      const type = resolved?.type || detectCompanyType(query);

      await getValuation({
        symbol,
        type,
        methods: ["dcf", "comps", "rnpv", "ai"],
        aiSummary: true,
      });
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      setError(err instanceof Error ? err.message : "Something went wrong");
    }
  }

  function handleSubmit(query: string) {
    if (mode === "analysis") handleAnalyze(query);
    else handleValuation(query);
  }

  const hasReport = streamedText.length > 0 || isStreaming || valuationResult !== null;
  const isLoading = mode === "analysis" ? isStreaming : valuationLoading;

  function scrollToAI() {
    aiToolRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  return (
    <main
      className="flex flex-col"
      style={{
        minHeight: "calc(100vh - 57px)",
        background: "#0a0f1e",
      }}
    >
      {/* ── Background grid overlay ───────────────────────────────────────── */}
      <div
        className="pointer-events-none fixed inset-0 z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(139,92,246,0.04) 1px, transparent 1px), linear-gradient(90deg, rgba(139,92,246,0.04) 1px, transparent 1px)",
          backgroundSize: "48px 48px",
        }}
      />

      <div className="relative z-10 flex flex-col">
        {/* ── Hero ─────────────────────────────────────────────────────────── */}
        <section className="flex flex-col items-center justify-center text-center px-4 pt-20 pb-16 gap-6">
          {/* Eyebrow */}
          <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-purple-500/30 bg-purple-500/10 text-purple-300 text-xs font-semibold tracking-wide uppercase">
            <span className="w-1.5 h-1.5 rounded-full bg-purple-400 animate-pulse" />
            BioFi · DeSci · Arbitrum Sepolia
          </span>

          {/* Headline */}
          <h1 className="text-4xl sm:text-6xl font-black leading-tight max-w-3xl">
            <span className="text-white">Where Biotech Alpha</span>
            <br />
            <span
              style={{
                background: "linear-gradient(135deg, #a855f7 0%, #3b82f6 60%, #06b6d4 100%)",
                WebkitBackgroundClip: "text",
                WebkitTextFillColor: "transparent",
              }}
            >
              Lives Onchain
            </span>
          </h1>

          {/* Subheadline */}
          <p className="text-slate-400 text-lg sm:text-xl max-w-xl leading-relaxed">
            AI-powered biotech research, DeSci token swaps, and meme launches —
            all onchain, all permissionless.
          </p>

          {/* CTAs */}
          <div className="flex flex-wrap items-center justify-center gap-3 mt-2">
            <button
              onClick={scrollToAI}
              className="px-7 py-3 rounded-xl bg-purple-600 hover:bg-purple-500 text-white font-semibold text-sm transition-all hover:shadow-lg hover:shadow-purple-500/25 active:scale-95"
            >
              Start Analyzing →
            </button>
            <Link
              href="/meme"
              className="px-7 py-3 rounded-xl border border-slate-600 hover:border-purple-500/60 text-slate-300 hover:text-white font-semibold text-sm transition-all hover:bg-purple-500/10"
            >
              🚀 Launch a Meme
            </Link>
          </div>
        </section>

        {/* ── Stats Bar ────────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto w-full px-4 pb-12">
          <div className="rounded-2xl border border-slate-700/50 bg-slate-800/30 backdrop-blur-sm px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-y-4 gap-x-2 text-center">
            {STATS.map((s) => (
              <div key={s.label} className="flex flex-col gap-0.5">
                <span className="text-white font-bold text-sm sm:text-base">{s.value}</span>
                <span className="text-slate-500 text-xs">{s.label}</span>
              </div>
            ))}
          </div>
        </section>

        {/* ── Feature Cards ────────────────────────────────────────────────── */}
        <section className="max-w-4xl mx-auto w-full px-4 pb-16">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {FEATURE_CARDS.map((card) => {
              const inner = (
                <div
                  className={`group h-full rounded-2xl border ${card.border} bg-gradient-to-br ${card.accent} p-5 flex flex-col gap-3 hover:scale-[1.02] transition-all cursor-pointer`}
                >
                  <div className="flex items-start justify-between">
                    <span className="text-3xl">{card.icon}</span>
                    <span className="text-xs px-2 py-0.5 rounded-full bg-slate-700/60 text-slate-400 border border-slate-600/40">
                      {card.tag}
                    </span>
                  </div>
                  <div>
                    <h3 className="text-white font-bold text-base">{card.title}</h3>
                    <p className="text-slate-400 text-sm mt-1 leading-relaxed">{card.desc}</p>
                  </div>
                  <span className="text-xs text-slate-500 group-hover:text-purple-400 transition-colors mt-auto">
                    Explore →
                  </span>
                </div>
              );

              return card.href.startsWith("#") ? (
                <button key={card.title} onClick={scrollToAI} className="text-left h-full">
                  {inner}
                </button>
              ) : (
                <Link key={card.title} href={card.href} className="h-full">
                  {inner}
                </Link>
              );
            })}
          </div>
        </section>

        {/* ── AI Tool ──────────────────────────────────────────────────────── */}
        <section
          id="ai-tool"
          ref={aiToolRef}
          className="border-t border-slate-800/60 scroll-mt-16"
        >
          {/* Section header */}
          <div className="max-w-6xl mx-auto px-4 pt-12 pb-6 text-center">
            <h2 className="text-2xl font-bold text-white">🧬 AI Research Tool</h2>
            <p className="text-slate-500 text-sm mt-1">
              Gemini-powered analysis and valuation for biotech projects &amp; DeSci tokens
            </p>
          </div>

          {/* Mode Toggle */}
          <div className="flex justify-center pb-4">
            <div className="flex bg-slate-800/80 border border-slate-700/50 rounded-xl p-1 gap-1">
              <button
                onClick={() => setMode("analysis")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "analysis"
                    ? "bg-blue-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                📝 Analysis
              </button>
              <button
                onClick={() => setMode("valuation")}
                className={`px-5 py-2 rounded-lg text-sm font-medium transition-colors ${
                  mode === "valuation"
                    ? "bg-purple-600 text-white shadow-sm"
                    : "text-slate-400 hover:text-white"
                }`}
              >
                💰 Valuation
              </button>
            </div>
          </div>

          {/* Search area */}
          <div
            className={`transition-all duration-500 ${
              hasReport
                ? "py-6 border-b border-slate-800 bg-[#0d1425]/60"
                : "py-10"
            }`}
          >
            <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-6 w-full">
              {!hasReport && (
                <div className="text-center space-y-3">
                  <p className="text-slate-400 text-base max-w-xl">
                    {mode === "analysis"
                      ? "Enter a project or token name to get a structured investment analysis covering scientific credibility, team, clinical data, and tokenomics."
                      : "Enter a ticker or company name to get a comprehensive valuation using DCF, Comps, rNPV, and AI analysis."}
                  </p>
                </div>
              )}
              <SearchForm onSubmit={handleSubmit} isLoading={isLoading} mode={mode} />
              {!hasReport && (
                <p className="text-xs text-slate-600">
                  {mode === "analysis"
                    ? "e.g. BioNTech, CURE, Moderna, GenomicDAO"
                    : "e.g. MRNA, VITA, PFE, BioNTech"}
                </p>
              )}
            </div>
          </div>

          {/* Report */}
          {hasReport && (
            <div className="max-w-6xl mx-auto px-4 py-8 w-full">
              <div className="rounded-xl border border-amber-600/30 bg-amber-900/20 p-4 text-center mb-6">
                <p className="text-amber-400 text-sm font-medium">
                  ⚠️ Investment Risk Warning: Stocks and tokens may become worthless.
                  Analysis and valuation results are for reference only.
                  Do your own research before making any investment decisions.
                </p>
              </div>

              {currentQuery && (
                <div className="mb-6">
                  <div className="flex items-center gap-3 flex-wrap">
                    <h3 className="text-xl font-semibold text-white">
                      {mode === "analysis" ? "Analysis" : "Valuation"}:{" "}
                      <span className={mode === "analysis" ? "text-blue-400" : "text-purple-400"}>
                        {currentQuery}
                      </span>
                    </h3>
                    {cacheStatus === "HIT" && (
                      <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                        Cached result
                      </span>
                    )}
                  </div>
                  {isLoading && (
                    <p className="text-sm text-slate-500 mt-1">
                      {mode === "analysis" ? "Generating report…" : "Calculating valuation…"}
                    </p>
                  )}
                </div>
              )}

              {error ? (
                isNotFoundError(error) ? (
                  <NotFoundState
                    query={currentQuery}
                    mode={mode}
                    onRetry={() => handleSubmit(currentQuery)}
                  />
                ) : (
                  <div className="rounded-xl border border-red-700 bg-red-900/20 p-6 text-red-400 text-sm">
                    {error}
                  </div>
                )
              ) : mode === "analysis" ? (
                <AnalysisReport streamedText={streamedText} isStreaming={isStreaming} />
              ) : (
                valuationResult && <ValuationReport data={valuationResult} isLoading={valuationLoading} />
              )}
            </div>
          )}
        </section>

        {/* ── Footer ───────────────────────────────────────────────────────── */}
        <footer className="border-t border-slate-800 py-6 mt-auto">
          <div className="max-w-6xl mx-auto px-4 flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-600">
            <span>XCure — Not financial advice. Research purposes only.</span>
            <a
              href="https://github.com/chloeisreal/xcure"
              target="_blank"
              rel="noopener noreferrer"
              className="hover:text-slate-400 transition-colors"
            >
              GitHub ↗
            </a>
          </div>
        </footer>
      </div>
    </main>
  );
}
