"use client";

import { ShieldCheck, ShieldAlert } from "lucide-react";
import { Avatar } from "@/components/Avatar";

type Signal = Record<string, string | boolean>;

type ProfileFields = {
  city?: string;
  school?: string;
  github?: string;
  linkedin?: string;
  instagram?: string;
};

interface BrainCardHeroProps {
  name: string;
  signal?: Signal;
  brainConfidence?: number | null;
  profile?: ProfileFields;
  avatarUrl?: string | null;
  variant?: "full" | "compact";
}

function humanize(k: string): string {
  const s = k.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function valueLabel(v: string | boolean): string {
  return typeof v === "boolean" ? (v ? "yes" : "no") : v;
}

/**
 * The "cool" Brain Card summary — gradient hero with avatar, signal pills,
 * confidence, and verification. Whole-person (no founder rank/tier). The full
 * scan sections live in a separate ScanCard, gated by connection.
 */
export function BrainCardHero({
  name,
  signal,
  brainConfidence,
  profile,
  avatarUrl,
  variant = "full",
}: BrainCardHeroProps) {
  const compact = variant === "compact";
  const pills = signal ? Object.entries(signal) : [];

  const gh = !!profile?.github, li = !!profile?.linkedin, ig = !!profile?.instagram;
  const verified = gh && li;
  const tags = [gh && "GitHub", li && "LinkedIn", ig && "Instagram"].filter(Boolean).join(" · ");

  return (
    <div
      className="relative overflow-hidden rounded-2xl border"
      style={{
        backgroundColor: "#0a0a0f",
        backgroundImage:
          "radial-gradient(circle at 20% 20%, rgba(16,185,129,0.22) 0%, transparent 55%), radial-gradient(circle at 80% 80%, rgba(139,92,246,0.18) 0%, transparent 55%)",
        borderColor: "rgba(148,163,184,0.18)",
        padding: compact ? "28px 32px" : "44px 48px",
        color: "white",
      }}
    >
      {/* Generated liquid-chrome texture — material depth behind the content */}
      <div className="absolute inset-0 z-0 card-liquid" aria-hidden />

      <div className="relative z-10">
      {/* Brand row */}
      <div className="flex items-center gap-3 mb-6">
        <div
          className="flex items-center justify-center font-bold"
          style={{ width: compact ? 32 : 40, height: compact ? 32 : 40, borderRadius: 10, backgroundColor: "#10b981", fontSize: compact ? 16 : 20 }}
        >
          BS
        </div>
        <div className="font-semibold" style={{ fontSize: compact ? 16 : 18 }}>BrainScan</div>
        <div className="ml-auto" style={{ color: "#94a3b8", fontSize: compact ? 13 : 14 }}>Brain Card</div>
      </div>

      {/* Identity row */}
      <div className="flex items-center gap-5 mb-6">
        <Avatar url={avatarUrl} name={name} size={compact ? 64 : 96} color="#10b981" textColor="#ffffff" />
        <div className="flex flex-col gap-1 min-w-0">
          <div className="font-bold leading-tight truncate" style={{ fontSize: compact ? 28 : 44 }}>{name}</div>
          {(profile?.city || profile?.school) && (
            <div className="flex flex-wrap items-center gap-x-2 text-sm" style={{ color: "#cbd5e1" }}>
              {profile?.city && <span>{profile.city}</span>}
              {profile?.school && <span>· {profile.school}</span>}
            </div>
          )}
        </div>
      </div>

      {/* Signal pills */}
      {pills.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-4">
          {pills.map(([k, v]) => (
            <span
              key={k}
              className="flex items-center gap-2 rounded-full border"
              style={{
                padding: compact ? "6px 12px" : "8px 16px",
                borderColor: "rgba(148,163,184,0.35)",
                backgroundColor: "rgba(255,255,255,0.04)",
                fontSize: compact ? 12 : 14,
                color: "white",
              }}
            >
              <span style={{ color: "#94a3b8" }}>{humanize(k)}:</span>
              <span className="font-semibold">{valueLabel(v)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Brain confidence */}
      {brainConfidence != null && (
        <div className="flex items-center gap-2" style={{ color: "#94a3b8", fontSize: compact ? 13 : 15 }}>
          <span>Brain confidence</span>
          <span className="font-bold" style={{ color: "#34d399" }}>{brainConfidence}%</span>
        </div>
      )}

      {/* Verification */}
      {profile && (
        <div
          className="inline-flex items-center gap-2 mt-3 rounded-full border"
          style={{
            padding: compact ? "5px 11px" : "6px 13px",
            fontSize: compact ? 11 : 12.5,
            borderColor: verified ? "rgba(16,185,129,0.4)" : "rgba(245,158,11,0.4)",
            backgroundColor: verified ? "rgba(16,185,129,0.12)" : "rgba(245,158,11,0.12)",
            color: verified ? "#34d399" : "#fbbf24",
          }}
        >
          {verified ? <ShieldCheck size={13} /> : <ShieldAlert size={13} />}
          <span className="font-semibold">{verified ? "Verified" : "Unverified"}</span>
          <span style={{ color: "#94a3b8" }}>{tags || "Connect GitHub / LinkedIn / Instagram"}</span>
        </div>
      )}
      </div>
    </div>
  );
}
