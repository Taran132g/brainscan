"use client";

import { useEffect, useMemo, useState } from "react";
import { Search, Filter, MapPin, Sparkles } from "lucide-react";
import { FounderGlobe } from "@/components/FounderGlobe";
import { FounderRankBadge } from "@/components/FounderRankBadge";
import { FAKE_USERS, TIER_INFO, FakeUser } from "@/lib/fake-users";
import type { Tier } from "@/lib/founder-rank";
import { fetchRealFounders } from "@/lib/real-users";
import { API_BASE_URL } from "@/lib/api";

const TIER_ORDER: Tier[] = ["Visionary", "Builder", "Operator", "Explorer", "Newcomer"];
const MARKETS = ["b2b", "consumer", "infrastructure", "mixed", "unclear"] as const;

export default function DiscoverPage() {
  const [tierFilter, setTierFilter] = useState<Tier | "all">("all");
  const [marketFilter, setMarketFilter] = useState<string>("all");
  const [search, setSearch] = useState("");
  const [highlightId, setHighlightId] = useState<string | undefined>();
  const [realFounders, setRealFounders] = useState<FakeUser[]>([]);

  useEffect(() => {
    fetchRealFounders(API_BASE_URL).then(setRealFounders);
  }, []);

  // Real founders first (so their dots aren't lost in the sea of fakes),
  // then fakes filling out to ~500 total
  const allUsers = useMemo<FakeUser[]>(() => {
    const realIds = new Set(realFounders.map((u) => u.id));
    const filler = FAKE_USERS.filter((u) => !realIds.has(u.id)).slice(0, Math.max(0, 500 - realFounders.length));
    return [...realFounders, ...filler];
  }, [realFounders]);

  const filtered = useMemo(() => {
    return allUsers.filter((u) => {
      if (tierFilter !== "all" && u.tier !== tierFilter) return false;
      if (marketFilter !== "all" && u.market_orientation !== marketFilter) return false;
      if (search) {
        const s = search.toLowerCase();
        if (
          !u.name.toLowerCase().includes(s) &&
          !u.city.toLowerCase().includes(s) &&
          !u.building.toLowerCase().includes(s)
        )
          return false;
      }
      return true;
    });
  }, [allUsers, tierFilter, marketFilter, search]);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Discover
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Browse {allUsers.length} founders worldwide. Filter by tier, market, or location.
        </p>
      </div>

      {/* Globe */}
      <section
        className="rounded-xl border overflow-hidden"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <FounderGlobe
          height={480}
          users={filtered}
          onUserClick={(u) => setHighlightId(u.id)}
          highlightId={highlightId}
          interactive
        />
      </section>

      {/* Filters */}
      <section
        className="p-4 rounded-xl border flex flex-col md:flex-row gap-3 md:items-center"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div
          className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
        >
          <Search size={15} style={{ color: "var(--text-secondary)" }} />
          <input
            type="text"
            placeholder="Search name, city, or what they're building..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="flex-1 bg-transparent text-sm outline-none"
            style={{ color: "var(--text-primary)" }}
          />
        </div>

        <select
          value={tierFilter}
          onChange={(e) => setTierFilter(e.target.value as Tier | "all")}
          className="px-3 py-2 rounded-lg text-sm outline-none border"
          style={{ backgroundColor: "var(--background)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="all">All tiers</option>
          {TIER_ORDER.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>

        <select
          value={marketFilter}
          onChange={(e) => setMarketFilter(e.target.value)}
          className="px-3 py-2 rounded-lg text-sm outline-none border"
          style={{ backgroundColor: "var(--background)", color: "var(--text-primary)", borderColor: "var(--border)" }}
        >
          <option value="all">All markets</option>
          {MARKETS.map((m) => (
            <option key={m} value={m}>{m}</option>
          ))}
        </select>
      </section>

      {/* Result count */}
      <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-secondary)" }}>
        <Filter size={12} />
        Showing {filtered.length} of {allUsers.length} founders
      </div>

      {/* User cards */}
      <section className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {filtered.slice(0, 60).map((u) => (
          <UserCard
            key={u.id}
            user={u}
            highlighted={u.id === highlightId}
            onHover={() => setHighlightId(u.id)}
          />
        ))}
      </section>

      {filtered.length > 60 && (
        <p className="text-xs text-center pt-2" style={{ color: "var(--text-secondary)" }}>
          Showing the first 60 results. Narrow your filters to find specific founders.
        </p>
      )}

      {filtered.length === 0 && (
        <div
          className="p-12 rounded-xl border text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Sparkles size={24} className="mx-auto mb-3" style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No founders match these filters. Try widening your search.
          </p>
        </div>
      )}
    </div>
  );
}

function UserCard({
  user,
  highlighted,
  onHover,
}: {
  user: FakeUser;
  highlighted: boolean;
  onHover: () => void;
}) {
  const info = TIER_INFO[user.tier];
  return (
    <div
      onMouseEnter={onHover}
      className="p-4 rounded-xl border flex flex-col gap-3 cursor-pointer transition-all"
      style={{
        backgroundColor: "var(--surface)",
        borderColor: highlighted ? info.color : "var(--border)",
        boxShadow: highlighted ? `0 0 0 1px ${info.color}` : "none",
      }}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 min-w-0">
          <div
            className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0"
            style={{ backgroundColor: info.color, color: "#0a0e17" }}
          >
            {user.rank}
          </div>
          <div className="min-w-0">
            <div className="text-sm font-semibold truncate" style={{ color: "var(--text-primary)" }}>
              {user.name}
            </div>
            <div className="text-[11px] flex items-center gap-1" style={{ color: "var(--text-secondary)" }}>
              <MapPin size={9} /> {user.city}
            </div>
          </div>
        </div>
        <FounderRankBadge rank={user.rank} tier={user.tier} size="sm" />
      </div>
      <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
        {user.building}
      </p>
      <div className="flex flex-wrap gap-1.5 pt-2 border-t" style={{ borderColor: "var(--border)" }}>
        <Tag>{user.market_orientation}</Tag>
        <Tag>{user.shipped_before ? "shipped before" : "first-timer"}</Tag>
        <Tag>{user.domain_obsession} obsession</Tag>
      </div>
    </div>
  );
}

function Tag({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="text-[10px] px-2 py-0.5 rounded-full"
      style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}
    >
      {children}
    </span>
  );
}
