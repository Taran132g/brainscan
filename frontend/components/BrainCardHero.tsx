"use client";

import { useState } from "react";
import { computeRank, TIER_INFO } from "@/lib/founder-rank";
import type { Tier } from "@/lib/fake-users";
import { SignalExplainerModal } from "@/components/SignalExplainerModal";
import type { SignalKey } from "@/lib/signal-research";

type Grade = "low" | "medium" | "high";
type FounderSignal = {
  domain_obsession?: Grade;
  emotional_stability_signal?: Grade;
  shipped_before?: boolean;
  market_orientation?: string;
  implied_intelligence?: Grade;
};

type ProfileFields = {
  full_name?: string;
  age?: string;
  city?: string;
  school?: string;
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
  gender?: string;
  github_quality?: Grade;
};

interface BrainCardHeroProps {
  name: string;
  founderSignal?: FounderSignal;
  brainConfidence?: number | null;
  profile?: ProfileFields;
  variant?: "full" | "compact";
}

function initialsOf(name: string): string {
  return name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();
}

type PillSpec = { key: SignalKey; label: string; value: string };

function pillsFrom(s: FounderSignal | undefined): PillSpec[] {
  if (!s) return [];
  const out: PillSpec[] = [];
  if (s.domain_obsession)
    out.push({ key: "domain_obsession", label: "Domain obsession", value: s.domain_obsession });
  if (s.shipped_before !== undefined)
    out.push({ key: "shipped_before", label: "Shipped before", value: s.shipped_before ? "yes" : "no" });
  if (s.market_orientation)
    out.push({ key: "market_orientation", label: "Market", value: s.market_orientation });
  if (s.emotional_stability_signal)
    out.push({ key: "emotional_stability_signal", label: "Emotional stability", value: s.emotional_stability_signal });
  if (s.implied_intelligence)
    out.push({ key: "implied_intelligence", label: "Implied intelligence", value: s.implied_intelligence });
  return out;
}

export function BrainCardHero({
  name,
  founderSignal,
  brainConfidence,
  profile,
  variant = "full",
}: BrainCardHeroProps) {
  const rankInfo = computeRank(founderSignal, profile);
  const tier: Tier = rankInfo.tier;
  const tierColor = TIER_INFO[tier].color;
  const tierDescription = TIER_INFO[tier].description;
  const initials = initialsOf(name) || "?";
  const pills = pillsFrom(founderSignal);
  const compact = variant === "compact";

  const [explain, setExplain] = useState<{ key: SignalKey; value: string } | null>(null);

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "#0a0a0f",
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(99,102,241,0.22) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.18) 0%, transparent 55%)",
        borderColor: "rgba(148,163,184,0.18)",
        padding: compact ? "28px 32px" : "44px 48px",
        color: "white",
      }}
    >
      {/* Brand row */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center font-bold"
          style={{
            width: compact ? 32 : 40,
            height: compact ? 32 : 40,
            borderRadius: 10,
            backgroundColor: "#6366f1",
            fontSize: compact ? 16 : 20,
          }}
        >
          FF
        </div>
        <div className="font-semibold" style={{ fontSize: compact ? 16 : 18 }}>
          FindingFounders
        </div>
        <div className="ml-auto" style={{ color: "#94a3b8", fontSize: compact ? 13 : 14 }}>
          Brain Card
        </div>
      </div>

      {/* Identity row */}
      <div className="flex items-center gap-5 mb-6">
        <div
          className="flex items-center justify-center font-bold rounded-full"
          style={{
            width: compact ? 64 : 96,
            height: compact ? 64 : 96,
            backgroundColor: "#6366f1",
            fontSize: compact ? 28 : 42,
          }}
        >
          {initials}
        </div>
        <div className="flex flex-col gap-1 min-w-0">
          <div
            className="font-bold leading-tight truncate"
            style={{ fontSize: compact ? 28 : 44 }}
          >
            {name}
          </div>
          <div
            className="flex items-center gap-2"
            style={{ color: "#cbd5e1", fontSize: compact ? 14 : 18 }}
          >
            <span>Rank {rankInfo.rank}/10 ·</span>
            <span style={{ color: tierColor, fontWeight: 600 }}>{tier}</span>
          </div>
          {!compact && (
            <div className="text-xs mt-1" style={{ color: "#94a3b8" }}>
              {tierDescription}
            </div>
          )}
        </div>
      </div>

      {/* Signal pills — tappable, opens research explainer */}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {pills.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => setExplain({ key: p.key, value: p.value })}
              className="flex items-center gap-2 rounded-full border transition-colors cursor-pointer hover:opacity-90"
              style={{
                padding: compact ? "6px 12px" : "8px 16px",
                borderColor: "rgba(148,163,184,0.35)",
                backgroundColor: "rgba(255,255,255,0.04)",
                fontSize: compact ? 12 : 14,
                color: "white",
              }}
              title={`Learn what "${p.label}" means`}
            >
              <span style={{ color: "#94a3b8" }}>{p.label}:</span>
              <span className="font-semibold">{p.value}</span>
            </button>
          ))}
        </div>
      )}

      {/* Brain confidence */}
      {brainConfidence != null && (
        <div
          className="flex items-center gap-2"
          style={{ color: "#94a3b8", fontSize: compact ? 13 : 15 }}
        >
          <span>Brain confidence</span>
          <span className="font-bold" style={{ color: tierColor }}>
            {brainConfidence}%
          </span>
        </div>
      )}

      <SignalExplainerModal
        signalKey={explain?.key ?? null}
        value={explain?.value ?? null}
        onClose={() => setExplain(null)}
      />
    </div>
  );
}
