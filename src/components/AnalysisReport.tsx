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

  return (
    <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
      {SECTION_META.map((meta, idx) => {
        const parsed = sections[meta.id];
        // Determine if this section is the one currently being streamed (last visible)
        const populated = Object.keys(sections);
        const isThisLast =
          isStreaming && populated[populated.length - 1] === meta.id;

        return (
          <ReportSection
            key={meta.id}
            meta={meta}
            badgeValue={parsed?.badgeValue ?? (isStreaming && idx === 0 && !parsed ? "…" : "—")}
            content={parsed?.content ?? ""}
            isStreaming={isThisLast}
          />
        );
      })}
    </div>
  );
}
