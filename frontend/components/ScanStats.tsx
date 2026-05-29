"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Sparkles, CheckCircle, AlertCircle, ArrowRight } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Stats = {
  total_scans: number;
  available_credits: number;
  subscription_tier: "free" | "brain_card" | "full" | string;
  subscription_status: string;
  uploads_in_cycle: number;
  free_uploads_per_cycle: number | null;
  remaining_this_cycle: number | null;
  first_free_available?: boolean;
  can_upload: boolean;
};

/**
 * Brain scan counter card. Shows lifetime scans, what the user can do right
 * now (credit / monthly quota / paywall), and a "buy more" CTA when blocked.
 */
export function ScanStats({ compact = false }: { compact?: boolean }) {
  const { user } = useAuth();
  const [stats, setStats] = useState<Stats | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_BASE_URL}/api/profile/${user.id}/scan-stats`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setStats)
      .catch(() => setError(true));
  }, [user]);

  if (error || !stats) {
    return null;
  }

  // What text to show under the headline scan count
  let remainingText = "";
  if (stats.subscription_tier === "full" && stats.remaining_this_cycle !== null) {
    remainingText = `${stats.remaining_this_cycle} / ${stats.free_uploads_per_cycle} free uploads left this cycle`;
    if (stats.available_credits > 0) {
      remainingText += ` · +${stats.available_credits} purchased credit${stats.available_credits === 1 ? "" : "s"}`;
    }
  } else if (stats.first_free_available) {
    remainingText = "✨ Your first brain card is free";
  } else if (stats.available_credits > 0) {
    remainingText = `${stats.available_credits} scan${stats.available_credits === 1 ? "" : "s"} available`;
  } else if (stats.subscription_tier === "free") {
    remainingText = "You've used your free brain card — buy a scan for $0.99";
  } else {
    remainingText = "Out of credits — buy an extra scan for $0.99";
  }

  if (compact) {
    return (
      <div
        className="flex items-center justify-between gap-3 px-4 py-3 rounded-lg border"
        style={{
          backgroundColor: "var(--surface)",
          borderColor: stats.can_upload ? "var(--border)" : "#f59e0b",
        }}
      >
        <div className="flex items-center gap-3 min-w-0">
          {stats.can_upload ? (
            <CheckCircle size={15} style={{ color: "#10b981", flexShrink: 0 }} />
          ) : (
            <AlertCircle size={15} style={{ color: "#f59e0b", flexShrink: 0 }} />
          )}
          <div className="min-w-0">
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {stats.total_scans} brain scan{stats.total_scans === 1 ? "" : "s"} so far
            </div>
            <div className="text-xs truncate" style={{ color: "var(--text-secondary)" }}>
              {remainingText}
            </div>
          </div>
        </div>
        {!stats.can_upload && (
          <Link
            href="/pricing?required=extra_upload"
            className="text-xs font-medium whitespace-nowrap px-3 py-1.5 rounded-lg"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Buy scan $0.99
          </Link>
        )}
      </div>
    );
  }

  return (
    <div
      className="p-5 rounded-xl border flex flex-col gap-4"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: stats.can_upload ? "var(--border)" : "#f59e0b",
      }}
    >
      <div className="flex items-center gap-3">
        <Sparkles size={18} style={{ color: "var(--accent)" }} />
        <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
          Brain scans
        </h2>
      </div>

      <div className="grid grid-cols-3 gap-3">
        <Stat label="Total scans done" value={String(stats.total_scans)} />
        <Stat label="Credits available" value={String(stats.available_credits)} />
        <Stat
          label={stats.subscription_tier === "full" ? "Cycle remaining" : "Plan"}
          value={
            stats.subscription_tier === "full" && stats.remaining_this_cycle !== null
              ? `${stats.remaining_this_cycle} / ${stats.free_uploads_per_cycle}`
              : stats.subscription_tier === "brain_card"
              ? "Brain Card"
              : stats.subscription_tier === "full"
              ? "Full"
              : "Free"
          }
        />
      </div>

      <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
        {remainingText}
      </p>

      {!stats.can_upload && (
        <Link
          href="/pricing?required=extra_upload"
          className="inline-flex items-center gap-2 self-start px-4 py-2 rounded-lg text-sm font-medium"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Buy extra scan — $0.99 <ArrowRight size={13} />
        </Link>
      )}
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div
      className="flex flex-col gap-1 px-3 py-2 rounded-lg"
      style={{ backgroundColor: "var(--background)" }}
    >
      <span className="text-[10px]" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
