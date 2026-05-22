"use client";

import { TIER_INFO } from "@/lib/founder-rank";
import type { Tier } from "@/lib/fake-users";
import { Award } from "lucide-react";

type Size = "sm" | "md" | "lg";

export function FounderRankBadge({
  rank,
  tier,
  size = "md",
  showDescription = false,
}: {
  rank: number;
  tier: Tier;
  size?: Size;
  showDescription?: boolean;
}) {
  const info = TIER_INFO[tier];

  if (size === "sm") {
    return (
      <span
        className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold border"
        style={{ borderColor: info.color, color: info.color, backgroundColor: info.bg }}
      >
        <Award size={11} /> {tier} · {rank}/10
      </span>
    );
  }

  if (size === "lg") {
    return (
      <div
        className="flex items-center gap-4 px-5 py-4 rounded-xl border"
        style={{ borderColor: info.color, backgroundColor: info.bg }}
      >
        <div
          className="w-14 h-14 rounded-full flex items-center justify-center text-xl font-bold flex-shrink-0"
          style={{ backgroundColor: info.color, color: "#0a0e17" }}
        >
          {rank}
        </div>
        <div className="flex flex-col">
          <span className="text-[10px] uppercase tracking-wider mb-0.5" style={{ color: "var(--text-secondary)" }}>
            Founder rank
          </span>
          <span className="text-lg font-bold" style={{ color: info.color }}>
            {tier}
          </span>
          {showDescription && (
            <span className="text-xs mt-1" style={{ color: "var(--text-secondary)" }}>
              {info.description}
            </span>
          )}
        </div>
      </div>
    );
  }

  // md (default)
  return (
    <div
      className="flex items-center gap-3 px-4 py-2.5 rounded-lg border"
      style={{ borderColor: info.color, backgroundColor: info.bg }}
    >
      <div
        className="w-9 h-9 rounded-full flex items-center justify-center text-sm font-bold"
        style={{ backgroundColor: info.color, color: "#0a0e17" }}
      >
        {rank}
      </div>
      <div className="flex flex-col">
        <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
          Rank
        </span>
        <span className="text-sm font-semibold" style={{ color: info.color }}>
          {tier}
        </span>
      </div>
    </div>
  );
}
