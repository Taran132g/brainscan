"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Brain, User, Lightbulb, Heart, Users, ArrowRight, RefreshCw, Share2, Check } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { BrainCardHero } from "@/components/BrainCardHero";
import { MatchPanel } from "@/components/MatchPanel";

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

type PublicProfileFields = {
  full_name?: string;
  age?: string;
  city?: string;
  school?: string;
  github?: string;
  linkedin?: string;
  avatar_url?: string | null;
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

export default function ProfilePage() {
  const { userId } = useParams<{ userId: string }>();
  const { user } = useAuth();
  const [brainCard, setBrainCard] = useState<BrainCard | null>(null);
  const [vaultQuality, setVaultQuality] = useState<VaultQuality | null>(null);
  const [userName, setUserName] = useState("");
  const [publicProfile, setPublicProfile] = useState<PublicProfileFields | undefined>(undefined);
  const [viewerCard, setViewerCard] = useState<BrainCard | null>(null);
  const [pairCompatibility, setPairCompatibility] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [shareCopied, setShareCopied] = useState(false);

  const handleShare = async () => {
    if (typeof window === "undefined") return;
    // Prefer the configured canonical app URL so dev shares don't leak localhost links.
    const baseUrl =
      (process.env.NEXT_PUBLIC_APP_URL as string | undefined) || window.location.origin;
    const url = `${baseUrl}/profile/${userId}`;
    const title = `${userName || "My"} FindingFounders Brain Card`;

    // Only use the OS share sheet on touch devices — desktop Chrome's
    // navigator.share often opens nothing on non-HTTPS origins.
    const isTouch =
      typeof navigator !== "undefined" &&
      typeof navigator.share === "function" &&
      (navigator.maxTouchPoints ?? 0) > 0;

    if (isTouch) {
      try {
        await navigator.share({ title, url });
        return;
      } catch {
        // User cancelled or share blocked — fall through to clipboard.
      }
    }

    try {
      await navigator.clipboard.writeText(url);
      setShareCopied(true);
      setTimeout(() => setShareCopied(false), 2000);
    } catch {
      window.prompt("Copy this link:", url);
    }
  };

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

    // Public cached snapshot — no auth required so the profile is shareable.
    fetch(`${API_BASE_URL}/api/profile/${userId}/public-card`)
      .then((r) => {
        if (!r.ok) throw new Error("not found");
        return r.json();
      })
      .then((data) => {
        setBrainCard(data.brain_card);
        setUserName(data.full_name || userId);
        if (data.profile) setPublicProfile(data.profile);
        if (data.brain_confidence != null) {
          setVaultQuality({
            score: data.brain_confidence,
            stats: { note_count: 0, total_words: 0, avg_words_per_note: 0 },
          });
        }
        setLoading(false);
      })
      .catch(() => {
        setError("Could not load profile.");
        setLoading(false);
      });
  }, [userId]);

  // Pull the viewer's own brain card if they're signed in and viewing someone else.
  // Powers the MatchPanel comparison view.
  useEffect(() => {
    if (!user || user.id === userId) {
      setViewerCard(null);
      setPairCompatibility(null);
      return;
    }
    fetch(`${API_BASE_URL}/api/profile/${user.id}/public-card`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        if (data?.brain_card) setViewerCard(data.brain_card);
      })
      .catch(() => setViewerCard(null));

    // Same blended compatibility the matches list shows, so the two agree.
    authedFetch(`${API_BASE_URL}/api/match/score/${userId}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => setPairCompatibility(typeof d?.compatibility === "number" ? d.compatibility : null))
      .catch(() => setPairCompatibility(null));
  }, [user, userId]);

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleShare}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {shareCopied ? <Check size={13} /> : <Share2 size={13} />}
            {shareCopied ? "Copied" : "Share card"}
          </button>
          {user && (
            <Link
              href="/dashboard"
              className="text-sm hover:underline"
              style={{ color: "var(--text-secondary)" }}
            >
              Dashboard
            </Link>
          )}
          {user?.id === userId ? (
            <Link
              href="/upload"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              <RefreshCw size={13} /> Re-upload vault
            </Link>
          ) : !user ? (
            <Link
              href="/auth"
              className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-opacity hover:opacity-80"
              style={{ backgroundColor: "var(--surface)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}
            >
              Sign in
            </Link>
          ) : null}
        </div>
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
            {/* Compatibility panel — signed-in visitor looking at someone else's card */}
            {user && user.id !== userId && viewerCard?.founder_signal && brainCard?.founder_signal && (
              <div className="mb-6">
                <MatchPanel
                  hostName={userName || "this founder"}
                  viewerName={(user.user_metadata?.full_name as string) || "you"}
                  hostSignal={brainCard.founder_signal}
                  viewerSignal={viewerCard.founder_signal}
                  compatibility={pairCompatibility}
                />
              </div>
            )}

            {/* Hero — matches the OG share-card visual */}
            <div className="mb-8">
              <BrainCardHero
                name={userName || (userId as string)}
                founderSignal={brainCard?.founder_signal}
                brainConfidence={vaultQuality?.score ?? null}
                profile={
                  publicProfile ?? (user?.user_metadata as PublicProfileFields | undefined)
                }
                avatarUrl={publicProfile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)}
                variant="full"
              />
            </div>

            {/* Vault stats line — only when we have real counts (session cache, not the public read) */}
            {vaultQuality && vaultQuality.stats.note_count > 0 && (
              <p className="text-xs mb-6" style={{ color: "var(--text-secondary)" }}>
                Built from {vaultQuality.stats.note_count.toLocaleString()} notes · {vaultQuality.stats.total_words.toLocaleString()} words · {vaultQuality.stats.avg_words_per_note} avg words/note
              </p>
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

            {/* Conversion CTA — only shown to visitors, not the profile owner */}
            {user?.id !== userId && (
              <Link
                href={user ? "/upload" : "/auth"}
                className="mt-10 block rounded-2xl border overflow-hidden transition-opacity hover:opacity-95"
                style={{
                  backgroundColor: "#0a0a0f",
                  backgroundImage:
                    "radial-gradient(circle at 15% 20%, rgba(16,185,129,0.22) 0%, transparent 55%), radial-gradient(circle at 85% 80%, rgba(139,92,246,0.18) 0%, transparent 55%)",
                  borderColor: "rgba(148,163,184,0.18)",
                  padding: "32px 36px",
                  color: "white",
                }}
              >
                <div className="flex items-center gap-3 mb-3" style={{ color: "#cbd5e1" }}>
                  <Brain size={18} style={{ color: "#a78bfa" }} />
                  <span className="text-xs uppercase tracking-wider font-semibold">
                    Built with FindingFounders
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {user ? "Generate your own brain card." : "See what your brain card says about you."}
                </h3>
                <p className="text-sm mb-5" style={{ color: "#cbd5e1" }}>
                  {user
                    ? "Upload your vault — we'll pull 5 sections + a founder signal score from how you actually write."
                    : "We extract a co-founder profile from your own writing. 5 sections, a founder signal score, and a public card you can share like this one."}
                </p>
                <span
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "white" }}
                >
                  {user ? "Upload your vault" : "Get your brain card"} <ArrowRight size={14} />
                </span>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
