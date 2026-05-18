"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Brain, User, Lightbulb, Heart, Users, ArrowRight, RefreshCw } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, authedFetch } from "@/lib/api";

type FounderSignal = {
  domain_obsession?: "low" | "medium" | "high";
  shipped_before?: boolean;
  emotional_stability_signal?: "low" | "medium" | "high";
  market_orientation?: "b2b" | "consumer" | "infrastructure" | "mixed" | "unclear";
  implied_intelligence?: "low" | "medium" | "high";
};

type BrainCard = {
  sections: Record<string, string>;
  founder_signal?: FounderSignal;
  raw?: unknown;
};

type VaultQuality = {
  score: number;
  stats: {
    note_count: number;
    total_words: number;
    avg_words_per_note: number;
  };
};

const SECTION_CONFIG = [
  { key: "Who They Are", icon: <User size={16} />, color: "#6366f1" },
  { key: "What They're Building", icon: <Brain size={16} />, color: "#8b5cf6" },
  { key: "How They Think", icon: <Lightbulb size={16} />, color: "#06b6d4" },
  { key: "What They Value", icon: <Heart size={16} />, color: "#ec4899" },
  { key: "What They Likely Need in a Co-Founder", icon: <Users size={16} />, color: "#10b981" },
];

function SignalPill({ label, value }: { label: string; value: string }) {
  const intensityColor =
    value === "high" || value === "yes"
      ? "#10b981"
      : value === "medium"
      ? "#f59e0b"
      : value === "low" || value === "no"
      ? "#f87171"
      : "var(--accent)";
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
      <span style={{ color: intensityColor, fontWeight: 600 }}>{value}</span>
    </div>
  );
}

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const [brainCard, setBrainCard] = useState<BrainCard | null>(null);
  const [vaultQuality, setVaultQuality] = useState<VaultQuality | null>(null);
  const [userName, setUserName] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    // Try sessionStorage first (just came from upload)
    const cached = sessionStorage.getItem(`braincard_${userId}`);
    const name = sessionStorage.getItem(`user_name_${userId}`);
    const quality = sessionStorage.getItem(`vault_quality_${userId}`);
    if (cached) {
      setBrainCard(JSON.parse(cached));
      setUserName(name || userId);
      if (quality) setVaultQuality(JSON.parse(quality));
      setLoading(false);
      return;
    }

    // Otherwise fetch from API
    authedFetch(`${API_BASE_URL}/api/profile/${userId}/brain-card`)
      .then((r) => r.json())
      .then((data) => {
        setBrainCard(data.brain_card);
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load profile.");
        setLoading(false);
      });
  }, [userId]);

  const initials = userName
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <Link
          href="/upload"
          className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
          style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
        >
          <RefreshCw size={13} /> Re-upload vault
        </Link>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {loading ? (
          <div className="flex flex-col items-center gap-4 py-24">
            <Brain size={36} className="animate-pulse" style={{ color: "var(--accent)" }} />
            <p style={{ color: "var(--text-secondary)" }}>Loading brain card...</p>
          </div>
        ) : error ? (
          <div className="text-center py-24">
            <p style={{ color: "#f87171" }}>{error}</p>
            <Link href="/upload" className="mt-4 inline-block text-sm" style={{ color: "var(--accent)" }}>
              Go back to upload
            </Link>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="flex items-center gap-4 mb-6">
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center text-lg font-bold"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                {initials || "?"}
              </div>
              <div className="flex-1">
                <h1 className="text-2xl font-bold" style={{ color: "var(--text-primary)" }}>
                  {userName || userId}
                </h1>
                <p className="text-sm" style={{ color: "var(--text-secondary)" }}>Brain Card · Co-founder profile</p>
              </div>
              {vaultQuality && (
                <div
                  className="text-right px-3 py-2 rounded-lg border"
                  style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                >
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Brain confidence</div>
                  <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>
                    {vaultQuality.score}%
                  </div>
                </div>
              )}
            </div>

            {/* Vault stats line */}
            {vaultQuality && (
              <p className="text-xs mb-8" style={{ color: "var(--text-secondary)" }}>
                Built from {vaultQuality.stats.note_count.toLocaleString()} notes · {vaultQuality.stats.total_words.toLocaleString()} words · {vaultQuality.stats.avg_words_per_note} avg words/note
              </p>
            )}

            {/* Founder signal pills */}
            {brainCard?.founder_signal && (
              <div className="flex flex-wrap gap-2 mb-8">
                {brainCard.founder_signal.domain_obsession && (
                  <SignalPill
                    label="Domain obsession"
                    value={brainCard.founder_signal.domain_obsession}
                  />
                )}
                {brainCard.founder_signal.emotional_stability_signal && (
                  <SignalPill
                    label="Emotional stability"
                    value={brainCard.founder_signal.emotional_stability_signal}
                  />
                )}
                {brainCard.founder_signal.shipped_before !== undefined && (
                  <SignalPill
                    label="Shipped before"
                    value={brainCard.founder_signal.shipped_before ? "yes" : "no"}
                  />
                )}
                {brainCard.founder_signal.market_orientation && (
                  <SignalPill
                    label="Market orientation"
                    value={brainCard.founder_signal.market_orientation}
                  />
                )}
                {brainCard.founder_signal.implied_intelligence && (
                  <SignalPill
                    label="Implied intelligence"
                    value={brainCard.founder_signal.implied_intelligence}
                  />
                )}
              </div>
            )}

            {/* Sections */}
            <div className="flex flex-col gap-5">
              {SECTION_CONFIG.map(({ key, icon, color }) => {
                const content = brainCard?.sections?.[key];
                if (!content) return null;
                return (
                  <div
                    key={key}
                    className="p-6 rounded-xl border"
                    style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <span style={{ color }}>{icon}</span>
                      <h2 className="text-sm font-semibold" style={{ color }}>
                        {key}
                      </h2>
                    </div>
                    <div className="text-sm leading-relaxed whitespace-pre-wrap" style={{ color: "var(--text-primary)" }}>
                      {/* Render bold markdown */}
                      {content.split(/(\*\*[^*]+\*\*)/).map((part, i) =>
                        part.startsWith("**") && part.endsWith("**") ? (
                          <strong key={i}>{part.slice(2, -2)}</strong>
                        ) : (
                          part
                        )
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

            {/* CTA — matching (Phase 2) */}
            <div
              className="mt-8 p-6 rounded-xl border text-center"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <Users size={28} className="mx-auto mb-3" style={{ color: "var(--accent)" }} />
              <h3 className="font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
                Ready to find your match?
              </h3>
              <p className="text-sm mb-4" style={{ color: "var(--text-secondary)" }}>
                Matching launches in Phase 2. Drop your email to get notified when it goes live.
              </p>
              <div className="flex gap-2 max-w-sm mx-auto">
                <input
                  type="email"
                  placeholder="your@email.com"
                  className="flex-1 px-4 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
                <button
                  className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium"
                  style={{ backgroundColor: "var(--accent)", color: "white" }}
                >
                  Notify me <ArrowRight size={13} />
                </button>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
