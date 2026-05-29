"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Users, MapPin, GraduationCap, Sparkles, ArrowRight, Loader2, RefreshCw, ExternalLink, Filter } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Match = {
  user_id: string;
  mutual_score: number;
  a_to_b_score: number;
  b_to_a_score: number | null;
  name: string;
  city?: string;
  school?: string;
  tier?: string;
  rank?: number;
  preview?: string;
  building_preview?: string;
  market?: string;
  intelligence?: "low" | "medium" | "high";
  primary_role?: "technical" | "business" | "design" | "domain" | null;
  shipped_before?: boolean;
  distance_km?: number | null;
};

type SortMode = "mutual_fit" | "smartest" | "rank" | "nearest";

const SORT_OPTIONS: { value: SortMode; label: string }[] = [
  { value: "mutual_fit", label: "Mutual fit" },
  { value: "smartest", label: "Smartest first" },
  { value: "rank", label: "Highest rank" },
  { value: "nearest", label: "Nearest to me" },
];

const MARKET_OPTIONS = [
  { value: "all", label: "Any market" },
  { value: "b2b", label: "B2B" },
  { value: "consumer", label: "Consumer" },
  { value: "infrastructure", label: "Infrastructure" },
  { value: "mixed", label: "Mixed" },
];

const ROLE_OPTIONS = [
  { value: "all", label: "Any role" },
  { value: "technical", label: "Technical" },
  { value: "business", label: "Business / GTM" },
  { value: "design", label: "Design / UX" },
  { value: "domain", label: "Domain expert" },
];

const TIER_OPTIONS = [
  { value: "all", label: "Any tier" },
  { value: "Visionary", label: "Visionary" },
  { value: "Builder", label: "Builder" },
  { value: "Operator", label: "Operator" },
  { value: "Explorer", label: "Explorer" },
  { value: "Newcomer", label: "Newcomer" },
];

const TIER_COLOR: Record<string, string> = {
  Visionary: "#fbbf24",
  Builder: "#a78bfa",
  Operator: "#60a5fa",
  Explorer: "#34d399",
  Newcomer: "#94a3b8",
};

export default function MatchesPage() {
  const { user } = useAuth();
  const [matches, setMatches] = useState<Match[] | null>(null);
  const [totalAvailable, setTotalAvailable] = useState(0);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Filters + sort
  const [sort, setSort] = useState<SortMode>("mutual_fit");
  const [market, setMarket] = useState("all");
  const [role, setRole] = useState("all");
  const [tier, setTier] = useState("all");
  const [shippedOnly, setShippedOnly] = useState(false);

  const load = async () => {
    if (!user) return;
    setLoading(true);
    setError("");
    try {
      const params = new URLSearchParams({
        top_k: "10",
        sort,
        market,
        role,
        tier,
        shipped_only: shippedOnly ? "true" : "false",
      });
      const r = await authedFetch(`${API_BASE_URL}/api/match/me?${params.toString()}`);
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(typeof d.detail === "string" ? d.detail : "Could not load matches");
      }
      const data = await r.json();
      setMatches(data.matches || []);
      setTotalAvailable(data.total_available || 0);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load matches.");
      setMatches([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { load(); }, [user, sort, market, role, tier, shippedOnly]);

  return (
    <div className="flex flex-col gap-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
            Your matches
          </h1>
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            {matches && matches.length > 0
              ? `Showing ${matches.length} of ${totalAvailable} ${sort === "nearest" ? "by distance" : sort === "smartest" ? "by intelligence" : sort === "rank" ? "by rank" : "by mutual fit"}.`
              : "Co-founders whose thinking complements yours."}
          </p>
        </div>
        <button
          onClick={load}
          disabled={loading}
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs border disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          {loading ? <Loader2 size={12} className="animate-spin" /> : <RefreshCw size={12} />}
          Refresh
        </button>
      </div>

      {/* Filter / sort bar */}
      <section
        className="p-3 rounded-xl border flex flex-wrap items-center gap-2"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <Filter size={13} style={{ color: "var(--text-secondary)" }} />
        <FilterSelect label="Sort" value={sort} options={SORT_OPTIONS as { value: string; label: string }[]} onChange={(v) => setSort(v as SortMode)} />
        <FilterSelect label="Role" value={role} options={ROLE_OPTIONS} onChange={setRole} />
        <FilterSelect label="Market" value={market} options={MARKET_OPTIONS} onChange={setMarket} />
        <FilterSelect label="Tier" value={tier} options={TIER_OPTIONS} onChange={setTier} />
        <label
          className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg border cursor-pointer text-xs"
          style={{
            borderColor: shippedOnly ? "var(--accent)" : "var(--border)",
            backgroundColor: shippedOnly ? "var(--accent-glow)" : "transparent",
            color: shippedOnly ? "var(--accent)" : "var(--text-secondary)",
          }}
        >
          <input
            type="checkbox"
            checked={shippedOnly}
            onChange={(e) => setShippedOnly(e.target.checked)}
            className="appearance-none w-3 h-3 rounded border"
            style={{
              borderColor: "currentColor",
              backgroundColor: shippedOnly ? "currentColor" : "transparent",
            }}
          />
          Shipped only
        </label>
      </section>

      {error && (
        <p className="text-sm px-4 py-3 rounded-lg"
          style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
          {error}
        </p>
      )}

      {loading && !matches && (
        <div className="flex flex-col items-center gap-4 py-20">
          <Sparkles size={28} className="animate-pulse" style={{ color: "var(--accent)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            Finding founders whose brains complement yours...
          </p>
        </div>
      )}

      {!loading && matches && matches.length === 0 && (
        <div
          className="p-10 rounded-xl border text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Users size={32} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            No matches yet
          </h2>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
            Either you haven&apos;t uploaded a brain card yet, or you&apos;re an early adopter. Try uploading
            your vault, or invite a builder friend so the matching pool grows.
          </p>
          <Link
            href="/upload"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Upload vault <ArrowRight size={13} />
          </Link>
        </div>
      )}

      {matches && matches.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {matches.map((m) => (
            <MatchCard key={m.user_id} match={m} />
          ))}
        </div>
      )}

      {matches && matches.length > 0 && (
        <p className="text-xs text-center mt-2" style={{ color: "var(--text-secondary)" }}>
          Hinge-style mutual scoring — only shows founders whose &quot;needs&quot; line up with your profile <em>and</em> whose profile lines up with what you need.
        </p>
      )}
    </div>
  );
}

function FilterSelect({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: { value: string; label: string }[];
  onChange: (v: string) => void;
}) {
  return (
    <label className="flex items-center gap-1.5">
      <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
        {label}
      </span>
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="text-xs rounded-lg px-2.5 py-1.5 outline-none border"
        style={{
          backgroundColor: "var(--background)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
        }}
      >
        {options.map((o) => (
          <option key={o.value} value={o.value}>{o.label}</option>
        ))}
      </select>
    </label>
  );
}

function MatchCard({ match }: { match: Match }) {
  const tierColor = match.tier ? TIER_COLOR[match.tier] ?? "var(--accent)" : "var(--accent)";
  const initials = match.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();
  const mutualPct = Math.round(match.mutual_score * 100);
  const roleLabel = match.primary_role
    ? match.primary_role[0].toUpperCase() + match.primary_role.slice(1)
    : null;

  return (
    <Link
      href={`/profile/${match.user_id}`}
      className="block p-5 rounded-xl border transition-all hover:opacity-90"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-start gap-4 mb-3">
        <div
          className="w-12 h-12 rounded-full flex items-center justify-center text-base font-bold flex-shrink-0"
          style={{ backgroundColor: tierColor, color: "#0a0e17" }}
        >
          {initials || "?"}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {match.name}
            </h3>
            {match.rank != null && match.rank > 0 && (
              <span
                className="text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full whitespace-nowrap"
                style={{ backgroundColor: `${tierColor}25`, color: tierColor }}
              >
                {match.tier} · {match.rank}/10
              </span>
            )}
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px]" style={{ color: "var(--text-secondary)" }}>
            {match.city && (
              <span className="flex items-center gap-1">
                <MapPin size={10} /> {match.city}
                {typeof match.distance_km === "number" && (
                  <span style={{ opacity: 0.7 }}> · {match.distance_km < 50 ? "nearby" : `${Math.round(match.distance_km).toLocaleString()} km`}</span>
                )}
              </span>
            )}
            {match.school && (
              <span className="flex items-center gap-1"><GraduationCap size={10} /> {match.school}</span>
            )}
          </div>
          {(roleLabel || match.market || match.intelligence) && (
            <div className="flex flex-wrap items-center gap-1.5 mt-1.5">
              {roleLabel && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--accent-glow)", color: "var(--accent)" }}>
                  {roleLabel}
                </span>
              )}
              {match.market && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
                  {match.market}
                </span>
              )}
              {match.intelligence === "high" && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(16,185,129,0.15)", color: "#10b981" }}>
                  high IQ
                </span>
              )}
              {match.shipped_before && (
                <span className="text-[10px] px-1.5 py-0.5 rounded-full"
                  style={{ backgroundColor: "rgba(167,139,250,0.15)", color: "#a78bfa" }}>
                  shipped
                </span>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Mutual score bar */}
      <div className="mb-3">
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
            Mutual fit
          </span>
          <span className="text-xs font-semibold" style={{ color: tierColor }}>
            {mutualPct}%
          </span>
        </div>
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--background)" }}>
          <div
            className="h-full rounded-full transition-all"
            style={{
              width: `${mutualPct}%`,
              backgroundColor: tierColor,
            }}
          />
        </div>
      </div>

      {(match.building_preview || match.preview) && (
        <p
          className="text-xs leading-relaxed line-clamp-3 mb-2"
          style={{ color: "var(--text-secondary)" }}
        >
          {match.building_preview || match.preview}
        </p>
      )}

      <div className="flex items-center justify-end gap-1 text-[11px] font-medium" style={{ color: "var(--accent)" }}>
        View brain card <ExternalLink size={10} />
      </div>
    </Link>
  );
}
