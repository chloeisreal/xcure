"use client";

import { useState, useRef } from "react";
import SearchForm from "@/components/SearchForm";
import AnalysisReport from "@/components/AnalysisReport";

export default function Home() {
  const [streamedText, setStreamedText] = useState("");
  const [isStreaming, setIsStreaming] = useState(false);
  const [currentQuery, setCurrentQuery] = useState("");
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

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

  const hasReport = streamedText.length > 0 || isStreaming;

  return (
    <main className="flex flex-col" style={{ minHeight: "calc(100vh - 57px)" }}>
      {/* Search area */}
      <section
        className={`transition-all duration-500 ${
          hasReport
            ? "py-6 border-b border-slate-800 bg-[#0d1425]/60"
            : "flex-1 flex items-center py-20"
        }`}
      >
        <div className="max-w-6xl mx-auto px-4 flex flex-col items-center gap-6 w-full">
          {!hasReport && (
            <div className="text-center space-y-3">
              <h2 className="text-3xl sm:text-4xl font-bold text-white">
                AI-powered biotech research
              </h2>
              <p className="text-slate-400 text-base sm:text-lg max-w-xl">
                Enter a project or token name to get a structured investment analysis covering
                scientific credibility, team, clinical data, and tokenomics.
              </p>
            </div>
          )}
          <SearchForm onSubmit={handleAnalyze} isLoading={isStreaming} />
          {!hasReport && (
            <p className="text-xs text-slate-600">e.g. BioNTech, CURE, Moderna, GenomicDAO</p>
          )}
        </div>
      </section>

      {/* Report */}
      {hasReport && (
        <section className="flex-1 max-w-6xl mx-auto px-4 py-8 w-full">
          {currentQuery && (
            <div className="mb-6">
              <h2 className="text-xl font-semibold text-white">
                Analysis: <span className="text-blue-400">{currentQuery}</span>
              </h2>
              {isStreaming && (
                <p className="text-sm text-slate-500 mt-1">Generating report…</p>
              )}
            </div>
          )}
          {error ? (
            <div className="rounded-xl border border-red-700 bg-red-900/20 p-6 text-red-400 text-sm">
              {error}
            </div>
          ) : (
            <AnalysisReport streamedText={streamedText} isStreaming={isStreaming} />
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
