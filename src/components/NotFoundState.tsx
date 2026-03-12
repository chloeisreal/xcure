"use client";

import React from "react";

interface NotFoundStateProps {
  query: string;
  mode: "analysis" | "valuation";
  onRetry?: () => void;
  suggestions?: string[];
}

export default function NotFoundState({
  query,
  mode,
  onRetry,
  suggestions = [],
}: NotFoundStateProps) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#111827] p-8 text-center">
      <div className="text-4xl mb-4">🔍</div>
      <h3 className="text-xl font-semibold text-white mb-2">
        {mode === "valuation" ? "Company Not Found" : "Analysis Not Available"}
      </h3>
      <p className="text-slate-400 mb-6">
        We couldn't find "{query}" in our database.
      </p>

      {suggestions.length > 0 && (
        <div className="mb-6">
          <p className="text-sm text-slate-500 mb-2">Did you mean:</p>
          <div className="flex flex-wrap justify-center gap-2">
            {suggestions.map((suggestion) => (
              <button
                key={suggestion}
                onClick={() => onRetry?.()}
                className="px-3 py-1 rounded-full bg-slate-700 hover:bg-slate-600 text-sm text-slate-300 transition-colors"
              >
                {suggestion}
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm text-slate-500 space-y-1">
        <p>Suggestions:</p>
        <ul className="list-disc list-inside space-y-1">
          <li>Check the spelling of the company name or ticker symbol</li>
          <li>Try using the stock ticker (e.g., MRNA, BNTX)</li>
          {mode === "valuation" && (
            <li>For Hong Kong stocks, use the 5-digit stock code</li>
          )}
        </ul>
      </div>

      {onRetry && (
        <button
          onClick={onRetry}
          className="mt-6 px-4 py-2 rounded-lg bg-blue-600 hover:bg-blue-500 text-sm font-medium text-white transition-colors"
        >
          Try Again
        </button>
      )}
    </div>
  );
}
