"use client";

import { useState, useRef } from "react";
import SearchForm from "@/components/SearchForm";
import AnalysisReport from "@/components/AnalysisReport";
import ValuationReport from "@/components/ValuationReport";
import NotFoundState from "@/components/NotFoundState";
import SearchFeedback from "@/components/SearchFeedback";
import { useValuation, detectCompanyType, extractSymbol, resolveCompanyName, searchCompaniesWithCandidates, type ValuationData, type CompanySearchResult } from "@/lib/valuation-client";

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
  const [cacheStatus, setCacheStatus] = useState<"HIT" | "MISS" | null>(null);
  const [candidates, setCandidates] = useState<CompanySearchResult[]>([]);
  const [selectedCandidate, setSelectedCandidate] = useState<CompanySearchResult | null>(null);
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
      if (cacheHeader) {
        setCacheStatus(cacheHeader as "HIT" | "MISS");
      }

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

  async function handleValuation(query: string, forceRefresh: boolean = false) {
    if (abortRef.current) abortRef.current.abort();
    const controller = new AbortController();
    abortRef.current = controller;

    setCurrentQuery(query);
    setError(null);
    setStreamedText("");
    setCandidates([]);
    setSelectedCandidate(null);

    try {
      const companyCandidates = await searchCompaniesWithCandidates(query);
      
      if (companyCandidates.length > 1) {
        // Multiple candidates, show selector
        setCandidates(companyCandidates);
        return;
      } else if (companyCandidates.length === 1) {
        // Only one candidate, use directly
        setSelectedCandidate(companyCandidates[0]);
        const resolved = companyCandidates[0];
        
        await getValuation({
          symbol: resolved.symbol,
          type: resolved.type,
          methods: ["dcf", "comps", "rnpv", "ai"],
          aiSummary: true,
        }, forceRefresh);
      } else {
        // No candidates in local DB, try as listed stock symbol
        const symbol = extractSymbol(query);
        const type = detectCompanyType(query);

        // Try to get valuation for listed stock
        try {
          await getValuation({
            symbol,
            type: 'listed',
            methods: ["dcf", "comps", "rnpv", "ai"],
            aiSummary: true,
          }, forceRefresh);
        } catch (valuationErr) {
          // If valuation also fails, show error with option to add new company
          if (valuationErr instanceof Error) {
            setError(valuationErr.message);
          } else {
            setError(`No company found for "${query}". You can add a new company to the database.`);
          }
        }
      }
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const errorMessage = err instanceof Error ? err.message : "Unknown error, please try again later";
      setError(errorMessage);
    }
  }

  async function handleSelectCandidate(candidate: CompanySearchResult, forceRefresh: boolean = false) {
    setSelectedCandidate(candidate);
    setCandidates([]);
    
    try {
      await getValuation({
        symbol: candidate.symbol,
        type: candidate.type,
        methods: ["dcf", "comps", "rnpv", "ai"],
        aiSummary: true,
      }, forceRefresh);
    } catch (err: unknown) {
      if (err instanceof Error && err.name === "AbortError") return;
      const errorMessage = err instanceof Error ? err.message : "Unknown error, please try again later";
      setError(errorMessage);
    }
  }

  function handleRefresh() {
    if (mode === "valuation" && currentQuery) {
      handleValuation(currentQuery, true);
    }
  }

  function handleSubmit(query: string) {
    if (mode === "analysis") {
      handleAnalyze(query);
    } else {
      handleValuation(query);
    }
  }

  const hasReport = streamedText.length > 0 || isStreaming || valuationResult !== null || error !== null;
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
          
          {/* Candidate Selector */}
          {candidates.length > 0 && (
            <div className="w-full max-w-2xl">
              <p className="text-sm text-slate-400 mb-2">Multiple matches found. Please select the correct company:</p>
              <div className="space-y-2">
                {candidates.map((candidate) => (
                  <button
                    key={`${candidate.type}-${candidate.id}`}
                    onClick={() => handleSelectCandidate(candidate)}
                    className="w-full text-left p-3 rounded-lg border border-slate-600 bg-slate-800/60 hover:bg-slate-700/60 hover:border-blue-500 transition-colors"
                  >
                    <div className="flex items-center justify-between">
                      <div>
                        <span className="text-white font-medium">{candidate.name}</span>
                        {candidate.nameEn && (
                          <span className="text-slate-400 ml-2">({candidate.nameEn})</span>
                        )}
                      </div>
                      <span className="text-xs px-2 py-1 rounded bg-slate-700 text-slate-300">
                        {candidate.type}
                      </span>
                    </div>
                  </button>
                ))}
              </div>
            </div>
          )}

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
              <div className="flex items-center gap-3 flex-wrap relative">
                <h2 className="text-xl font-semibold text-white">
                  {mode === "analysis" ? "Analysis" : "Valuation"}:{" "}
                  <span className={mode === "analysis" ? "text-blue-400" : "text-purple-400"}>
                    {selectedCandidate ? (selectedCandidate.nameEn || selectedCandidate.name) : currentQuery}
                  </span>
                </h2>
                {cacheStatus === "HIT" && (
                  <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-green-500/20 text-green-400 border border-green-500/30">
                    Cached result
                  </span>
                )}
                {mode === "valuation" && (valuationResult || error) && (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={handleRefresh}
                      disabled={isLoading}
                      className="flex items-center gap-1 px-2 py-1 rounded text-xs bg-slate-700 hover:bg-slate-600 text-slate-300 disabled:opacity-50 transition-colors"
                      title="Refresh (bypass cache)"
                    >
                      <span>🔄</span>
                      <span>Refresh</span>
                    </button>
                    <SearchFeedback 
                      query={currentQuery} 
                      selectedResult={valuationResult?.name}
                    />
                  </div>
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
                errorMessage={error}
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
