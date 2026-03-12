"use client";

import React from "react";

export type SectionMeta = {
  id: string;
  title: string;
  icon: string;
  badgeType: "score" | "tag" | "phase" | "risk";
};

export const SECTION_META: SectionMeta[] = [
  { id: "scientific", title: "Scientific Credibility", icon: "🔬", badgeType: "score" },
  { id: "team", title: "Team Background", icon: "👥", badgeType: "tag" },
  { id: "clinical", title: "Clinical Data Progress", icon: "📊", badgeType: "phase" },
  { id: "tokenomics", title: "Tokenomics & Investment Risk", icon: "⚠️", badgeType: "risk" },
];

type Props = {
  meta: SectionMeta;
  badgeValue: string;
  content: string;
  isStreaming?: boolean;
  isEmpty?: boolean;
};

function ScoreBadge({ value }: { value: string }) {
  const match = value.match(/(\d+)/);
  const score = match ? parseInt(match[1]) : null;
  const color =
    score !== null
      ? score >= 8
        ? "bg-green-500/20 text-green-400 border-green-500/30"
        : score >= 6
        ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
        : score >= 4
        ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
        : "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-slate-700/50 text-slate-400 border-slate-600";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {value || "—"}
    </span>
  );
}

function TagBadge({ value }: { value: string }) {
  return (
    <span className="px-2.5 py-1 rounded-full text-xs font-semibold bg-purple-500/20 text-purple-400 border border-purple-500/30">
      {value || "—"}
    </span>
  );
}

function PhaseBadge({ value }: { value: string }) {
  const color =
    value.includes("III")
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : value.includes("II")
      ? "bg-blue-500/20 text-blue-400 border-blue-500/30"
      : value.includes("I")
      ? "bg-cyan-500/20 text-cyan-400 border-cyan-500/30"
      : "bg-slate-700/50 text-slate-400 border-slate-600";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {value || "—"}
    </span>
  );
}

function RiskBadge({ value }: { value: string }) {
  const lower = value.toLowerCase();
  const color =
    lower === "low"
      ? "bg-green-500/20 text-green-400 border-green-500/30"
      : lower === "medium"
      ? "bg-amber-500/20 text-amber-400 border-amber-500/30"
      : lower === "high"
      ? "bg-red-500/20 text-red-400 border-red-500/30"
      : "bg-slate-700/50 text-slate-400 border-slate-600";
  return (
    <span className={`px-2.5 py-1 rounded-full text-xs font-semibold border ${color}`}>
      {value || "—"}
    </span>
  );
}

function Badge({ type, value }: { type: SectionMeta["badgeType"]; value: string }) {
  if (type === "score") return <ScoreBadge value={value} />;
  if (type === "tag") return <TagBadge value={value} />;
  if (type === "phase") return <PhaseBadge value={value} />;
  return <RiskBadge value={value} />;
}

export default function ReportSection({ meta, badgeValue, content, isStreaming, isEmpty }: Props) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#111827] p-6 flex flex-col gap-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{meta.icon}</span>
          <h2 className="text-lg font-semibold text-white">{meta.title}</h2>
        </div>
        <Badge type={meta.badgeType} value={badgeValue} />
      </div>

      <div className="text-slate-300 text-sm leading-relaxed whitespace-pre-wrap min-h-[60px]">
        {isEmpty ? (
          <span className="text-slate-500 italic">This information is not available yet.</span>
        ) : (
          <>
            {content}
            {isStreaming && (
              <span className="inline-block w-0.5 h-4 bg-blue-400 animate-pulse ml-0.5 align-text-bottom" />
            )}
          </>
        )}
      </div>
    </div>
  );
}
