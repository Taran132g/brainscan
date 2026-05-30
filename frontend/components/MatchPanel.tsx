"use client";

import { CheckCircle2, AlertTriangle, ArrowLeftRight } from "lucide-react";
import { scoreMatch, type PairVerdict } from "@/lib/match-score";

type Grade = "low" | "medium" | "high";
type Signal = {
  domain_obsession?: Grade;
  shipped_before?: boolean;
  emotional_stability_signal?: Grade;
  market_orientation?: string;
  implied_intelligence?: Grade;
};

interface Props {
  hostName: string;
  viewerName: string;
  hostSignal: Signal;
  viewerSignal: Signal;
  // Blended compatibility from the backend (same number the matches list shows).
  // When provided it drives the headline number; the signal pairs below remain
  // an explainable breakdown. Falls back to the client signal score if absent.
  compatibility?: number | null;
}

const VERDICT_COLOR: Record<PairVerdict, string> = {
  aligned: "#10b981",
  complementary: "#a78bfa",
  mismatch: "#f87171",
  unknown: "#94a3b8",
};

const VERDICT_LABEL: Record<PairVerdict, string> = {
  aligned: "Aligned",
  complementary: "Complementary",
  mismatch: "Gap",
  unknown: "—",
};

export function MatchPanel({ hostName, viewerName, hostSignal, viewerSignal, compatibility }: Props) {
  const result = scoreMatch(hostSignal, viewerSignal);

  // Headline number: prefer the backend's blended compatibility (matches the
  // matches list); fall back to the client signal score if it hasn't loaded.
  const score = typeof compatibility === "number" ? compatibility : result.score;

  const headline =
    score >= 80 ? "Strong fit. Worth a real conversation."
    : score >= 60 ? "Workable match. Some gaps worth probing."
    : score >= 40 ? "Mixed signals. Could complement if you're honest about the gaps."
    : "Tough fit on paper. Maybe better as friends.";

  // Pick the band color for the score number
  const scoreColor =
    score >= 80 ? "#10b981" : score >= 60 ? "#a78bfa" : score >= 40 ? "#f59e0b" : "#f87171";

  const firstHost = hostName.split(" ")[0] || "them";
  const firstViewer = viewerName.split(" ")[0] || "you";

  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{
        backgroundColor: "#0a0a0f",
        backgroundImage:
          "radial-gradient(circle at 20% 0%, rgba(16,185,129,0.18) 0%, transparent 60%), radial-gradient(circle at 100% 100%, rgba(139,92,246,0.14) 0%, transparent 55%)",
        borderColor: "rgba(148,163,184,0.18)",
        color: "white",
      }}
    >
      <div className="p-6 flex items-start justify-between gap-4">
        <div className="flex items-center gap-3">
          <div
            className="p-2.5 rounded-lg"
            style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#34d399" }}
          >
            <ArrowLeftRight size={20} />
          </div>
          <div>
            <div className="text-xs uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              Your match
            </div>
            <div className="text-lg font-bold">
              {firstViewer} × {firstHost}
            </div>
          </div>
        </div>
        <div className="text-right">
          <div className="text-4xl font-bold" style={{ color: scoreColor }}>
            {score}
          </div>
          <div className="text-xs" style={{ color: "#94a3b8" }}>
            /100
          </div>
        </div>
      </div>

      <div className="px-6 pb-4 text-sm" style={{ color: "#cbd5e1" }}>
        {headline}
      </div>

      <div className="border-t" style={{ borderColor: "rgba(148,163,184,0.15)" }}>
        {result.pairs.map((p) => {
          const color = VERDICT_COLOR[p.verdict];
          const Icon = p.verdict === "mismatch" ? AlertTriangle : CheckCircle2;
          return (
            <div
              key={p.label}
              className="px-6 py-3 flex items-center gap-4 border-b last:border-b-0"
              style={{ borderColor: "rgba(148,163,184,0.1)" }}
            >
              <div style={{ color }} className="shrink-0">
                <Icon size={16} />
              </div>
              <div className="flex-1 min-w-0">
                <div className="text-sm font-semibold">{p.label}</div>
                <div className="text-xs" style={{ color: "#94a3b8" }}>
                  {p.note}
                </div>
              </div>
              <div className="flex items-center gap-2 text-xs shrink-0" style={{ color: "#cbd5e1" }}>
                <span>
                  {firstViewer}: <span className="font-semibold text-white">{p.viewerValue}</span>
                </span>
                <span style={{ color: "#475569" }}>·</span>
                <span>
                  {firstHost}: <span className="font-semibold text-white">{p.hostValue}</span>
                </span>
              </div>
              <div
                className="px-2.5 py-1 rounded-full text-xs font-semibold shrink-0"
                style={{ color, backgroundColor: color + "1a", border: `1px solid ${color}44` }}
              >
                {VERDICT_LABEL[p.verdict]}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
