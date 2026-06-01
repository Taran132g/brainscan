"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Brain, ArrowRight, RefreshCw, Share2, Check, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";
import { ScanCard } from "@/components/ScanCard";

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
  instagram?: string;
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
    const title = `${userName || "My"} Brain Card · BrainScan`;

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
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>BrainScan</span>
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
            {/* Identity header */}
            <div className="flex items-center gap-4 mb-6">
              <Avatar
                url={publicProfile?.avatar_url ?? (user?.user_metadata?.avatar_url as string | undefined)}
                name={userName || "You"}
                size={72}
              />
              <div className="min-w-0">
                <h1 className="text-2xl font-bold truncate" style={{ color: "var(--text-primary)" }}>
                  {userName || "Brain Card"}
                </h1>
                <div className="flex flex-wrap items-center gap-x-2 mt-1 text-xs" style={{ color: "var(--text-secondary)" }}>
                  {publicProfile?.city && <span>{publicProfile.city}</span>}
                  {publicProfile?.school && <span>· {publicProfile.school}</span>}
                  {vaultQuality?.score != null && <span>· {vaultQuality.score}% confidence</span>}
                </div>
                {(() => {
                  const gh = !!publicProfile?.github, li = !!publicProfile?.linkedin, ig = !!publicProfile?.instagram;
                  const verified = gh && li;
                  const tags = [gh && "GitHub", li && "LinkedIn", ig && "Instagram"].filter(Boolean).join(" · ");
                  return (
                    <div className="inline-flex items-center gap-1.5 mt-2 px-2.5 py-1 rounded-full text-[11px] border"
                      style={{ borderColor: verified ? "rgba(16,185,129,0.4)" : "var(--border)", color: verified ? "#34d399" : "var(--text-secondary)" }}>
                      <ShieldCheck size={11} /> {tags || "Unverified"}
                    </div>
                  );
                })()}
              </div>
            </div>

            {/* The whole-person Brain Card */}
            <ScanCard
              domain="brainscan"
              sections={brainCard?.sections || {}}
              signal={brainCard?.founder_signal}
            />

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
                    Built with BrainScan
                  </span>
                </div>
                <h3 className="text-2xl font-bold mb-2">
                  {user ? "Generate your own Brain Card." : "See what your Brain Card says about you."}
                </h3>
                <p className="text-sm mb-5" style={{ color: "#cbd5e1" }}>
                  {user
                    ? "Upload your digital brain — we read how you think, your career, and how you connect into one card."
                    : "BrainScan reads your own writing into a whole-person card — then connects you with people you'd genuinely click with."}
                </p>
                <span
                  className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg text-sm font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "white" }}
                >
                  {user ? "Scan your brain" : "Get your Brain Card"} <ArrowRight size={14} />
                </span>
              </Link>
            )}
          </>
        )}
      </div>
    </div>
  );
}
