"use client";

import { useState, useRef } from "react";
import SearchForm from "@/components/SearchForm";
import AnalysisReport from "@/components/AnalysisReport";
import ValuationReport from "@/components/ValuationReport";
import NotFoundState from "@/components/NotFoundState";
import { useValuation, detectCompanyType, extractSymbol, resolveCompanyName, type ValuationData } from "@/lib/valuation-client";

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

export default function Home() {
  const [mode, setMode] = useState<Mode>("analysis");
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
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
    if (mode === "analysis") {
      handleAnalyze(query);
    } else {
      handleValuation(query);
    }
  }

  const hasReport = streamedText.length > 0 || isStreaming || valuationResult !== null;
  const isLoading = mode === "analysis" ? isStreaming : valuationLoading;

  return (
    <main className="flex flex-col" style={{ minHeight: "calc(100vh - 57px)" }}>
      {/* Mode Toggle */}
      <div className="flex justify-center pt-4">
        <div className="flex bg-slate-800 rounded-lg p-1">
          <button
            onClick={() => setMode("analysis")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "analysis"
                ? "bg-blue-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            📝 Analysis
          </button>
          <button
            onClick={() => setMode("valuation")}
            className={`px-4 py-2 rounded-md text-sm font-medium transition-colors ${
              mode === "valuation"
                ? "bg-purple-600 text-white"
                : "text-slate-400 hover:text-white"
            }`}
          >
            💰 Valuation
          </button>
        </div>
      </div>

      {/* Search area */}
      <section
        className={`transition-all duration-500 ${
          hasReport
            ? "py-6 border-b border-slate-800 bg-[#0d1425]/60"
            : "flex-1 flex items-center py-10"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-6 w-full">
          {!hasReport && (
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                {mode === "analysis" 
                  ? "AI-powered biotech research" 
                  : "AI-powered biotech valuation"
                }
              </h2>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl">
                {mode === "analysis" 
                  ? "Enter a project or token name to get a structured investment analysis covering scientific credibility, team, clinical data, and tokenomics."
                  : "Enter a ticker or company name to get a comprehensive valuation using DCF, Comps, rNPV, and AI analysis."
                }
              </p>
            </div>
          )}
          <SearchForm onSubmit={handleSubmit} isLoading={isLoading} mode={mode} />
          {!hasReport && (
            <p className="text-xs text-slate-600">
              {mode === "analysis" 
                ? "e.g. BioNTech, CURE, Moderna, GenomicDAO" 
                : "e.g. MRNA, VITA, PFE, BioNTech"
              }
            </p>
          )}
        </div>
      </section>

      {/* Report */}
      {hasReport && (
        <section className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
          {/* Risk Warning - Show above title */}
          <div className="rounded-xl border border-amber-600/30 bg-amber-900/20 p-4 text-center mb-6">
            <p className="text-amber-400 text-sm font-medium">
              ⚠️ Investment Risk Warning: Stocks and tokens may become worthless. 
              Analysis and valuation results are for reference only. 
              Do your own research before making any investment decisions.
            </p>
          </div>
          
          {currentQuery && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                {mode === "analysis" ? "Analysis" : "Valuation"}:{" "}
                <span className={mode === "analysis" ? "text-blue-400" : "text-purple-400"}>
                  {currentQuery}
                </span>
              </h2>
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
        </section>
      )}

      {/* Footer */}
      <footer className="border-t border-slate-800 py-4 mt-auto">
        <div className="max-w-6xl mx-auto px-4 text-center text-xs text-slate-600">
          XCure — Not financial advice. Research purposes only.
        </div>
      </footer>
    </main>
  );
}
