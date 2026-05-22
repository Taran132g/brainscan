"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, FileArchive, ArrowRight, Sparkles, ExternalLink } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type VaultQuality = {
  score: number;
  stats: { note_count: number; total_words: number; avg_words_per_note: number };
};

type BrainCard = {
  sections: Record<string, string>;
  founder_signal?: Record<string, string | boolean>;
};

export default function DashboardOverview() {
  const { user } = useAuth();
  const [brainCard, setBrainCard] = useState<BrainCard | null>(null);
  const [vaultQuality, setVaultQuality] = useState<VaultQuality | null>(null);

  useEffect(() => {
    if (!user) return;
    const card = sessionStorage.getItem(`braincard_${user.id}`);
    const quality = sessionStorage.getItem(`vault_quality_${user.id}`);
    if (card) setBrainCard(JSON.parse(card));
    if (quality) setVaultQuality(JSON.parse(quality));
  }, [user]);

  const displayName =
    (user?.user_metadata?.full_name as string | undefined) ?? user?.email ?? "";
  const firstName = displayName.split(" ")[0] || "there";
  const hasBrainCard = !!brainCard;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Welcome back, {firstName}
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          {hasBrainCard
            ? "Here's a snapshot of your brain card."
            : "Upload your vault to generate your brain card."}
        </p>
      </div>

      {hasBrainCard ? (
        <>
          {/* Brain card snapshot */}
          <section
            className="p-6 rounded-xl border"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="flex items-start justify-between mb-6">
              <div className="flex items-center gap-3">
                <Brain size={20} style={{ color: "var(--accent)" }} />
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Your brain card
                </h2>
              </div>
              {vaultQuality && (
                <div className="text-right">
                  <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Brain confidence</div>
                  <div className="text-xl font-bold" style={{ color: "var(--accent)" }}>
                    {vaultQuality.score}%
                  </div>
                </div>
              )}
            </div>

            {vaultQuality && (
              <p className="text-xs mb-4" style={{ color: "var(--text-secondary)" }}>
                Built from {vaultQuality.stats.note_count.toLocaleString()} notes ·{" "}
                {vaultQuality.stats.total_words.toLocaleString()} words ·{" "}
                {vaultQuality.stats.avg_words_per_note} avg words/note
              </p>
            )}

            {/* Signal pills */}
            {brainCard?.founder_signal && (
              <div className="flex flex-wrap gap-2 mb-6">
                {Object.entries(brainCard.founder_signal).map(([key, value]) => (
                  <SignalPill key={key} label={prettyLabel(key)} value={String(value)} />
                ))}
              </div>
            )}

            <Link
              href={`/profile/${user?.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: "var(--accent)" }}
            >
              View full brain card <ArrowRight size={13} />
            </Link>
          </section>

          {/* Quick actions */}
          <section>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Quick actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionCard
                icon={<FileArchive size={18} style={{ color: "var(--accent)" }} />}
                title="Re-upload your vault"
                description="Refresh your brain card with your latest notes"
                href="/upload"
              />
              <ActionCard
                icon={<Sparkles size={18} style={{ color: "var(--accent)" }} />}
                title="Matching"
                description="Coming soon — find co-founders who complement you"
                disabled
              />
            </div>
          </section>
        </>
      ) : (
        // Empty state — no brain card yet
        <section
          className="p-8 rounded-xl border text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Brain size={36} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-lg font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            Generate your brain card
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload your Obsidian vault to get a 5-section co-founder compatibility profile based on how you actually think.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Upload your vault <ArrowRight size={14} />
          </Link>
          <p className="text-xs mt-6" style={{ color: "var(--text-secondary)" }}>
            Don&apos;t have a vault?{" "}
            <a
              href="https://learn.nextwork.org/projects/ai-second-brain-claude-code"
              target="_blank"
              rel="noreferrer"
              className="hover:underline inline-flex items-center gap-1"
              style={{ color: "var(--accent)" }}
            >
              Build one <ExternalLink size={10} />
            </a>
          </p>
        </section>
      )}
    </div>
  );
}

function prettyLabel(key: string): string {
  return key
    .replace(/_/g, " ")
    .replace(/\bsignal\b/i, "")
    .replace(/\b\w/g, (l) => l.toUpperCase())
    .trim();
}

function SignalPill({ label, value }: { label: string; value: string }) {
  const color =
    value === "high" || value === "true" || value === "yes"
      ? "#10b981"
      : value === "medium"
      ? "#f59e0b"
      : value === "low" || value === "false" || value === "no"
      ? "#f87171"
      : "var(--accent)";
  const displayValue = value === "true" ? "yes" : value === "false" ? "no" : value;
  return (
    <div
      className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs border"
      style={{ borderColor: "var(--border)", backgroundColor: "var(--background)" }}
    >
      <span style={{ color: "var(--text-secondary)" }}>{label}:</span>
      <span style={{ color, fontWeight: 600 }}>{displayValue}</span>
    </div>
  );
}

function ActionCard({
  icon,
  title,
  description,
  href,
  disabled = false,
}: {
  icon: React.ReactNode;
  title: string;
  description: string;
  href?: string;
  disabled?: boolean;
}) {
  const card = (
    <div
      className="p-5 rounded-xl border flex flex-col gap-2 transition-opacity h-full"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
        opacity: disabled ? 0.5 : 1,
        cursor: disabled ? "not-allowed" : "pointer",
      }}
    >
      <div className="flex items-center gap-2">{icon}</div>
      <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h3>
      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{description}</p>
    </div>
  );
  if (disabled || !href) return card;
  return <Link href={href}>{card}</Link>;
}
