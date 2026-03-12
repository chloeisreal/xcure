"use client";

import React from "react";
import type { ValuationData, AIResult, DCFResult, CompsResult, rNPVResult } from "@/lib/valuation-client";

function formatNumber(num: number | undefined): string {
  if (num === undefined || num === null) return "—";
  if (num >= 1e9) return `$${(num / 1e9).toFixed(2)}B`;
  if (num >= 1e6) return `$${(num / 1e6).toFixed(2)}M`;
  if (num >= 1e3) return `$${(num / 1e3).toFixed(2)}K`;
  return `$${num.toFixed(2)}`;
}

function formatPercent(value: string | undefined): string {
  return value || "—";
}

function getRecommendationColor(rec: string | undefined): string {
  if (!rec) return "bg-slate-700 text-slate-400";
  const r = rec.toLowerCase();
  if (r.includes("strong buy")) return "bg-green-500/20 text-green-400 border-green-500/30";
  if (r.includes("buy")) return "bg-emerald-500/20 text-emerald-400 border-emerald-500/30";
  if (r.includes("sell")) return "bg-red-500/20 text-red-400 border-red-500/30";
  if (r.includes("strong sell")) return "bg-red-600/20 text-red-500 border-red-600/30";
  return "bg-amber-500/20 text-amber-400 border-amber-500/30";
}

interface Props {
  data: ValuationData;
  isLoading?: boolean;
}

export default function ValuationReport({ data, isLoading }: Props) {
  const { valuation, currentPrice, name, symbol, type } = data;

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 p-4 rounded-xl bg-[#111827] border border-slate-700">
        <div>
          <h2 className="text-xl font-semibold text-white">
            {name} <span className="text-blue-400">({symbol})</span>
          </h2>
          <p className="text-sm text-slate-400 capitalize">{type} • {data.currency}</p>
        </div>
        <div className="text-right">
          <p className="text-2xl font-bold text-white">
            {currentPrice ? formatNumber(currentPrice) : "—"}
          </p>
          <p className="text-sm text-slate-400">Current Price</p>
        </div>
      </div>

      {/* Valuation Methods Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* DCF */}
        {valuation.dcf && (
          <ValuationCard
            title="DCF Valuation"
            icon="📊"
            result={valuation.dcf}
            currentPrice={currentPrice}
          />
        )}

        {/* Comps */}
        {valuation.comps && (
          <ValuationCard
            title="Comps Analysis"
            icon="📈"
            result={valuation.comps}
            currentPrice={currentPrice}
          />
        )}

        {/* rNPV */}
        {valuation.rnpv && (
          <ValuationCard
            title="rNPV Pipeline"
            icon="🧪"
            result={valuation.rnpv}
            currentPrice={currentPrice}
          />
        )}

        {/* AI */}
        {valuation.ai && (
          <AIResultCard result={valuation.ai} />
        )}
      </div>

      {/* Data Sources */}
      <div className="text-xs text-slate-500">
        Data sources: {data.metadata.dataSources.join(", ")}
      </div>
    </div>
  );
}

function ValuationCard({
  title,
  icon,
  result,
  currentPrice,
}: {
  title: string;
  icon: string;
  result: DCFResult | CompsResult | rNPVResult;
  currentPrice?: number;
}) {
  const fairValue = result.fairValue;
  const upside = result.upside;
  const upsideNum = parseFloat(upside.replace(/[^0-9.-]/g, ""));
  const upsideColor = upsideNum >= 0 ? "text-green-400" : "text-red-400";

  return (
    <div className="rounded-xl border border-slate-700 bg-[#111827] p-5">
      <div className="flex items-center gap-2 mb-3">
        <span className="text-xl">{icon}</span>
        <h3 className="font-semibold text-white">{title}</h3>
      </div>

      <div className="space-y-2">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">Fair Value</span>
          <span className="text-lg font-bold text-white">{formatNumber(fairValue)}</span>
        </div>
        
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">Upside</span>
          <span className={`text-sm font-semibold ${upsideColor}`}>{formatPercent(upside)}</span>
        </div>

        {currentPrice && (
          <div className="flex justify-between items-baseline pt-2 border-t border-slate-700">
            <span className="text-sm text-slate-400">Implied</span>
            <span className="text-sm text-slate-300">
              {((fairValue / currentPrice - 1) * 100).toFixed(1)}%
            </span>
          </div>
        )}
      </div>

      {/* Method-specific details */}
      {"parameters" in result && result.parameters && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500 space-y-1">
          <p>Growth: {((result.parameters.growthRate || 0) * 100).toFixed(0)}%</p>
          <p>WACC: {((result.parameters.wacc || 0) * 100).toFixed(0)}%</p>
        </div>
      )}

      {"comparables" in result && result.comparables && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500">
          <p>vs: {result.comparables.slice(0, 3).join(", ")}</p>
        </div>
      )}

      {"pipelineValue" in result && (
        <div className="mt-3 pt-3 border-t border-slate-700 text-xs text-slate-500 space-y-1">
          <p>Pipeline: {formatNumber(result.pipelineValue)}</p>
          <p>Success: {((result.successProbability || 0) * 100).toFixed(0)}%</p>
        </div>
      )}
    </div>
  );
}

function AIResultCard({ result }: { result: AIResult }) {
  const [isExpanded, setIsExpanded] = React.useState(false);

  return (
    <div 
      className="rounded-xl border border-purple-500/30 bg-purple-900/10 p-5 cursor-pointer hover:border-purple-500/50 transition-colors"
      onClick={() => setIsExpanded(!isExpanded)}
    >
      <div className="flex items-center justify-between gap-2 mb-3">
        <div className="flex items-center gap-2">
          <span className="text-xl">🤖</span>
          <h3 className="font-semibold text-white">AI Analysis</h3>
        </div>
        <span className="text-xs text-purple-400">{isExpanded ? "▲ Click to collapse" : "▼ Click to expand"}</span>
      </div>

      <div className="space-y-3">
        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">Target Price</span>
          <span className="text-lg font-bold text-white">{formatNumber(result.fairValue)}</span>
        </div>

        <div className="flex justify-between items-center">
          <span className="text-sm text-slate-400">Recommendation</span>
          <span className={`px-3 py-1 rounded-full text-xs font-semibold border ${getRecommendationColor(result.recommendation)}`}>
            {result.recommendation || "—"}
          </span>
        </div>

        <div className="flex justify-between items-baseline">
          <span className="text-sm text-slate-400">Confidence</span>
          <span className="text-sm font-medium text-purple-400">{result.confidence || "—"}%</span>
        </div>

        {result.summary && (
          <div className={`pt-3 border-t border-purple-500/20 ${isExpanded ? '' : 'max-h-20 overflow-hidden'}`}>
            <p className={`text-xs text-slate-400 whitespace-pre-wrap ${isExpanded ? '' : 'line-clamp-3'}`}>{result.summary}</p>
          </div>
        )}
      </div>
    </div>
  );
}
