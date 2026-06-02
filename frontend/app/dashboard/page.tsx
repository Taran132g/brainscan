"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Brain, FileArchive, ArrowRight, Sparkles, ExternalLink, ScanLine } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { ScanCard } from "@/components/ScanCard";
import { BrainCardHero } from "@/components/BrainCardHero";
import { API_BASE_URL, authedFetch } from "@/lib/api";

type VaultQuality = {
  score: number;
  stats: { note_count: number; total_words: number; avg_words_per_note: number };
};

type BrainCard = {
  sections: Record<string, string>;
  founder_signal?: Record<string, string | boolean>;
};

type ServerRank = { score?: number | null; rank?: number | null; tier?: string | null };

export default function DashboardOverview() {
  const { user } = useAuth();
  const [brainCard, setBrainCard] = useState<BrainCard | null>(null);
  const [vaultQuality, setVaultQuality] = useState<VaultQuality | null>(null);
  const [githubQuality, setGithubQuality] = useState<"low" | "medium" | "high" | undefined>();
  const [serverRank, setServerRank] = useState<ServerRank | null>(null);
  const [serverProfile, setServerProfile] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!user) return;

    // 1) Prefer session-cached brain card (fresh from a just-completed upload)
    const card = sessionStorage.getItem(`braincard_${user.id}`);
    const quality = sessionStorage.getItem(`vault_quality_${user.id}`);
    if (card) setBrainCard(JSON.parse(card));
    if (quality) setVaultQuality(JSON.parse(quality));

    // 2) Always try the server snapshot — picks up any cross-session changes
    //    (LinkedIn / GitHub recompute, refreshed page, different browser, etc.)
    fetch(`${API_BASE_URL}/api/profile/${user.id}/public-card`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (!data) return;
        if (!card && data.brain_card) {
          setBrainCard(data.brain_card);
        }
        if (!quality && data.brain_confidence != null) {
          setVaultQuality({
            score: data.brain_confidence,
            stats: { note_count: 0, total_words: 0, avg_words_per_note: 0 },
          });
        }
        if (data.rank) setServerRank(data.rank);
        if (data.profile) setServerProfile(data.profile);
      })
      .catch(() => { /* nothing in DB yet — empty state is fine */ });

    // 3) GitHub grade fallback for users coming straight from /upload
    authedFetch(`${API_BASE_URL}/api/github/status`)
      .then((r) => r.ok ? r.json() : null)
      .then((data) => {
        if (data?.github_quality) setGithubQuality(data.github_quality);
      })
      .catch(() => { /* not connected — leave undefined */ });
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
            ? "Your founder scan. Run career & relationship scans anytime."
            : "Scan your digital brain to see how you actually think."}
        </p>
      </div>

      {hasBrainCard ? (
        <>
          {/* Cool summary card */}
          <BrainCardHero
            name={displayName || "You"}
            signal={brainCard?.founder_signal || (brainCard as { signal?: Record<string, string | boolean> })?.signal}
            brainConfidence={vaultQuality?.score ?? null}
            avatarUrl={(user?.user_metadata?.avatar_url as string | undefined) ?? null}
            profile={{
              city: user?.user_metadata?.city as string | undefined,
              school: user?.user_metadata?.school as string | undefined,
              github: user?.user_metadata?.github as string | undefined,
              linkedin: user?.user_metadata?.linkedin as string | undefined,
              instagram: user?.user_metadata?.instagram as string | undefined,
            }}
          />

          {/* Full brain scan — your own, always visible */}
          <ScanCard domain="brainscan" sections={brainCard!.sections} />

          {vaultQuality && (
            <p className="-mt-2 text-xs" style={{ color: "var(--text-secondary)" }}>
              Built from {vaultQuality.stats.note_count.toLocaleString()} notes ·{" "}
              {vaultQuality.stats.total_words.toLocaleString()} words ·{" "}
              {vaultQuality.stats.avg_words_per_note} avg words/note
            </p>
          )}

          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/dashboard/brain-card"
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: "var(--accent)" }}
            >
              Manage your Brain Card <ArrowRight size={13} />
            </Link>
            <Link
              href={`/profile/${user?.id}`}
              className="inline-flex items-center gap-1.5 text-sm font-medium hover:underline"
              style={{ color: "var(--accent)" }}
            >
              View public profile <ArrowRight size={13} />
            </Link>
          </div>

          {/* Quick actions */}
          <section>
            <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
              Quick actions
            </h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <ActionCard
                icon={<ScanLine size={18} style={{ color: "var(--accent)" }} />}
                title="Your Brain Card"
                description="Refresh it or re-upload your digital brain"
                href="/dashboard/brain-card"
              />
              <ActionCard
                icon={<Sparkles size={18} style={{ color: "var(--accent)" }} />}
                title="Privacy & sharing"
                description="Make your card private or hide sections"
                href="/dashboard/settings"
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
            Scan your brain
          </h2>
          <p className="text-sm mb-6 max-w-sm mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload your digital brain — Obsidian, Notion, or any knowledge base — and BrainScan reads how
            you actually think, what drives you, and how you connect.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Scan your brain <ArrowRight size={14} />
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
      className={`p-5 rounded-xl border flex flex-col gap-2 h-full ${disabled ? "" : "card-hover"}`}
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
