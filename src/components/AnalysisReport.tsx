"use client";

import React, { useMemo } from "react";
import ReportSection, { SECTION_META } from "./ReportSection";

type ParsedSection = {
  badgeValue: string;
  content: string;
};

/**
 * Parses the raw streamed text into 4 sections.
 * Each section header looks like:
 *   ## Scientific Credibility | Score: 7/10
 *   ## Team Background | Tag: Experienced
 *   ## Clinical Data Progress | Phase: Phase II
 *   ## Tokenomics & Investment Risk | Risk: Medium
 */
function parseStreamedText(text: string): Record<string, ParsedSection> {
  const result: Record<string, ParsedSection> = {};

  const sectionTitles = [
    { id: "scientific", pattern: /Scientific Credibility/ },
    { id: "team", pattern: /Team Background/ },
    { id: "clinical", pattern: /Clinical Data Progress/ },
    { id: "tokenomics", pattern: /Tokenomics & Investment Risk|Tokenomics and Investment Risk/ },
  ];

  // Split on ## headers
  const parts = text.split(/^##\s+/m);

  for (const part of parts) {
    if (!part.trim()) continue;

    const firstLine = part.split("\n")[0];
    const rest = part.slice(firstLine.length).trim();

    for (const { id, pattern } of sectionTitles) {
      if (pattern.test(firstLine)) {
        // Extract badge value from pipe-delimited header
        // e.g. "Scientific Credibility | Score: 7/10"
        const pipeIdx = firstLine.indexOf("|");
        let badgeValue = "";
        if (pipeIdx !== -1) {
          const afterPipe = firstLine.slice(pipeIdx + 1).trim();
          // Remove the label prefix (Score:, Tag:, Phase:, Risk:)
          const colonIdx = afterPipe.indexOf(":");
          badgeValue =
            colonIdx !== -1 ? afterPipe.slice(colonIdx + 1).trim() : afterPipe;
        }
        result[id] = { badgeValue, content: rest };
        break;
      }
    }
  }

  return result;
}

type Props = {
  streamedText: string;
  isStreaming: boolean;
};

export default function AnalysisReport({ streamedText, isStreaming }: Props) {
  const sections = useMemo(() => parseStreamedText(streamedText), [streamedText]);

  const hasAnyContent = Object.keys(sections).length > 0;
  const showSkeleton = isStreaming && !hasAnyContent;

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {SECTION_META.map((meta, idx) => {
        const parsed = sections[meta.id];
        
        if (showSkeleton) {
          return (
            <ReportSectionSkeleton key={meta.id} meta={meta} />
          );
        }

        const populated = Object.keys(sections);
        const isThisLast = isStreaming && populated[populated.length - 1] === meta.id;

        return (
          <ReportSection
            key={meta.id}
            meta={meta}
            badgeValue={parsed?.badgeValue ?? (isStreaming && idx === 0 && !parsed ? "…" : "—")}
            content={parsed?.content ?? ""}
            isStreaming={isThisLast}
            isEmpty={!parsed?.content && !isStreaming}
          />
        );
      })}
    </div>
  );
}

function ReportSectionSkeleton({ meta }: { meta: typeof SECTION_META[0] }) {
  return (
    <div className="rounded-xl border border-slate-700 bg-[#111827] p-6 animate-pulse">
      <div className="flex items-center justify-between flex-wrap gap-2 mb-4">
        <div className="flex items-center gap-3">
          <span className="text-2xl leading-none">{meta.icon}</span>
          <div className="h-5 bg-slate-700 rounded w-32"></div>
        </div>
        <div className="h-6 bg-slate-700 rounded w-16"></div>
      </div>

      <div className="space-y-2">
        <div className="h-3 bg-slate-700/50 rounded w-full"></div>
        <div className="h-3 bg-slate-700/50 rounded w-full"></div>
        <div className="h-3 bg-slate-700/50 rounded w-3/4"></div>
        <div className="h-3 bg-slate-700/50 rounded w-full"></div>
        <div className="h-3 bg-slate-700/50 rounded w-5/6"></div>
      </div>
    </div>
  );
}
