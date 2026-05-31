import { ImageResponse } from "next/og";
import { API_BASE_URL } from "@/lib/api";

export const alt = "Brain Card · BrainScan";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

type Grade = "low" | "medium" | "high";
type FounderSignal = {
  domain_obsession?: Grade;
  emotional_stability_signal?: Grade;
  shipped_before?: boolean;
  market_orientation?: string;
  implied_intelligence?: Grade;
};
type OgData = {
  full_name: string;
  brain_confidence: number | null;
  founder_signal: FounderSignal;
  github?: string | null;
  linkedin?: string | null;
  school?: string | null;
  age?: string | null;
  total_scans: number;
};

const GRADED_MAX = { high: 1.0, medium: 0.5, low: 0 } as const;

function computeRankServer(s: FounderSignal, hasLinkedin: boolean, school: string | null | undefined, age: string | null | undefined) {
  let score = 50;
  if (s.shipped_before) score += 10;
  if (s.emotional_stability_signal) {
    score += 10 * GRADED_MAX[s.emotional_stability_signal];
    if (s.emotional_stability_signal === "low") score -= 10;
  }
  if (s.domain_obsession) score += 15 * GRADED_MAX[s.domain_obsession];
  if (s.implied_intelligence) score += 6 * GRADED_MAX[s.implied_intelligence];
  if (hasLinkedin) score += 6;
  if (school) score += 4;
  if (age && parseInt(age) < 25) score += 5;
  score = Math.max(0, Math.min(100, Math.round(score)));
  const rank = Math.max(1, Math.min(10, Math.round(score / 10)));
  const tier =
    rank >= 9 ? "Visionary" : rank >= 7 ? "Builder" : rank >= 5 ? "Operator" : rank >= 3 ? "Explorer" : "Newcomer";
  return { score, rank, tier };
}

const TIER_COLOR: Record<string, string> = {
  Visionary: "#fbbf24",
  Builder: "#a78bfa",
  Operator: "#60a5fa",
  Explorer: "#34d399",
  Newcomer: "#94a3b8",
};

export default async function Image({ params }: { params: Promise<{ userId: string }> }) {
  const { userId } = await params;
  let data: OgData = {
    full_name: "Founder",
    brain_confidence: null,
    founder_signal: {},
    total_scans: 0,
  };
  try {
    const r = await fetch(`${API_BASE_URL}/api/og/profile/${userId}`, { cache: "no-store" });
    if (r.ok) data = await r.json();
  } catch {
    // Render a generic card if backend is unreachable.
  }

  const { rank, tier } = computeRankServer(
    data.founder_signal,
    !!data.linkedin,
    data.school,
    data.age,
  );
  const tierColor = TIER_COLOR[tier] || "#94a3b8";
  const initials = data.full_name
    .split(" ")
    .map((w) => w[0])
    .filter(Boolean)
    .slice(0, 2)
    .join("")
    .toUpperCase();

  const pills: { label: string; value: string }[] = [];
  if (data.founder_signal.domain_obsession)
    pills.push({ label: "Domain obsession", value: data.founder_signal.domain_obsession });
  if (data.founder_signal.shipped_before !== undefined)
    pills.push({ label: "Shipped before", value: data.founder_signal.shipped_before ? "yes" : "no" });
  if (data.founder_signal.market_orientation)
    pills.push({ label: "Market", value: data.founder_signal.market_orientation });

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          backgroundColor: "#0a0a0f",
          backgroundImage:
            "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.18) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.14) 0%, transparent 55%)",
          padding: "64px 72px",
          fontFamily: "sans-serif",
          color: "white",
        }}
      >
        {/* Brand row */}
        <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
          <div
            style={{
              width: 44,
              height: 44,
              borderRadius: 12,
              backgroundColor: "#10b981",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              fontSize: 26,
              fontWeight: 700,
            }}
          >
            BS
          </div>
          <div style={{ fontSize: 28, fontWeight: 600 }}>BrainScan</div>
          <div style={{ marginLeft: "auto", fontSize: 22, color: "#94a3b8" }}>Brain Card</div>
        </div>

        {/* Spacer */}
        <div style={{ flex: 1, display: "flex", flexDirection: "column", justifyContent: "center", gap: 28 }}>
          {/* Identity row */}
          <div style={{ display: "flex", alignItems: "center", gap: 28 }}>
            <div
              style={{
                width: 120,
                height: 120,
                borderRadius: "50%",
                backgroundColor: "#10b981",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
                fontSize: 56,
                fontWeight: 700,
              }}
            >
              {initials || "?"}
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              <div style={{ display: "flex", fontSize: 64, fontWeight: 700, lineHeight: 1.05 }}>{data.full_name}</div>
              <div style={{ display: "flex", gap: 8, fontSize: 26, color: "#cbd5e1" }}>
                <span>Rank {rank}/10 ·</span>
                <span style={{ color: tierColor, fontWeight: 600 }}>{tier}</span>
              </div>
            </div>
          </div>

          {/* Pills */}
          {pills.length > 0 && (
            <div style={{ display: "flex", gap: 14, flexWrap: "wrap" }}>
              {pills.map((p) => (
                <div
                  key={p.label}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    padding: "12px 22px",
                    borderRadius: 999,
                    border: "1px solid rgba(148,163,184,0.35)",
                    backgroundColor: "rgba(255,255,255,0.04)",
                    fontSize: 22,
                  }}
                >
                  <span style={{ color: "#94a3b8" }}>{p.label}:</span>
                  <span style={{ color: "white", fontWeight: 600 }}>{p.value}</span>
                </div>
              ))}
            </div>
          )}

          {data.brain_confidence != null && (
            <div style={{ display: "flex", gap: 8, fontSize: 22, color: "#94a3b8" }}>
              <span>Brain confidence</span>
              <span style={{ color: tierColor, fontWeight: 700 }}>{data.brain_confidence}%</span>
            </div>
          )}
        </div>

        {/* Footer */}
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 22, color: "#94a3b8" }}>
          <div style={{ display: "flex" }}>
            {(process.env.NEXT_PUBLIC_APP_URL || "https://findingfounders.app").replace(/^https?:\/\//, "")}
          </div>
          <div style={{ display: "flex" }}>Match by how you think</div>
        </div>
      </div>
    ),
    { ...size },
  );
}
