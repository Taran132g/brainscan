"use client";

import { Suspense, useCallback, useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import Link from "next/link";
import {
  MessageCircle, Check, X, Clock, Loader2, MapPin, ArrowLeft, Inbox, UserPlus, ArrowRight,
} from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ChatThread } from "@/components/ChatThread";
import { Avatar } from "@/components/Avatar";

type Connection = {
  match_id: string;
  other_user_id: string;
  other_name: string;
  other_avatar?: string | null;
  other_city: string;
  other_school: string;
  other_tier: string;
  other_rank: number;
  status: "connected" | "pending_outgoing" | "pending_incoming" | "passed" | "none";
};

const TIER_COLOR: Record<string, string> = {
  Visionary: "#fbbf24",
  Builder: "#a78bfa",
  Operator: "#60a5fa",
  Explorer: "#34d399",
  Newcomer: "#94a3b8",
};

function ConnectionsInner() {
  const { user } = useAuth();
  const searchParams = useSearchParams();
  const [connections, setConnections] = useState<Connection[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [activeMatch, setActiveMatch] = useState<string | null>(null);
  const [acting, setActing] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/match/connections`);
      if (!r.ok) throw new Error("Could not load connections");
      const data = await r.json();
      setConnections(data.connections || []);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load.");
      setConnections([]);
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  // Deep-link: /dashboard/connections?match=<id> opens that thread
  useEffect(() => {
    const m = searchParams.get("match");
    if (m) setActiveMatch(m);
  }, [searchParams]);

  const decide = async (otherId: string, accept: boolean) => {
    setActing(otherId);
    try {
      const r = await authedFetch(
        `${API_BASE_URL}/api/match/${otherId}/${accept ? "connect" : "pass"}`,
        { method: "POST" }
      );
      if (!r.ok) throw new Error("Action failed");
      await load();
    } catch (e) {
      setError(e instanceof Error ? e.message : "Action failed.");
    } finally {
      setActing(null);
    }
  };

  const incoming = (connections || []).filter((c) => c.status === "pending_incoming");
  const connected = (connections || []).filter((c) => c.status === "connected");
  const outgoing = (connections || []).filter((c) => c.status === "pending_outgoing");

  const active = connected.find((c) => c.match_id === activeMatch);

  // ----- Chat view -----
  if (active && user) {
    const tierColor = TIER_COLOR[active.other_tier] ?? "var(--accent)";
    return (
      <div className="flex flex-col gap-4">
        <button
          onClick={() => setActiveMatch(null)}
          className="flex items-center gap-2 text-sm w-fit"
          style={{ color: "var(--text-secondary)" }}
        >
          <ArrowLeft size={14} /> All connections
        </button>
        <div
          className="flex items-center gap-3 p-4 rounded-xl border"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Avatar url={active.other_avatar} name={active.other_name} size={44} color={tierColor} />
          <div className="flex-1 min-w-0">
            <Link
              href={`/profile/${active.other_user_id}`}
              className="text-base font-semibold hover:underline"
              style={{ color: "var(--text-primary)" }}
            >
              {active.other_name}
            </Link>
            <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
              {active.other_city && <span className="flex items-center gap-1"><MapPin size={10} /> {active.other_city}</span>}
              {active.other_tier && <span>{active.other_tier} · {active.other_rank}/10</span>}
            </div>
          </div>
        </div>
        <div
          className="p-4 rounded-xl border"
          style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
        >
          <ChatThread matchId={active.match_id} currentUserId={user.id} otherName={active.other_name} />
        </div>
      </div>
    );
  }

  // ----- List view -----
  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Connections
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Both founders accept before messaging unlocks.
        </p>
      </div>

      {error && (
        <p className="text-sm px-4 py-3 rounded-lg" style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
          {error}
        </p>
      )}

      {loading && !connections && (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      )}

      {connections && connections.length === 0 && (
        <div
          className="p-10 rounded-xl border text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Inbox size={30} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>
            No connections yet
          </h2>
          <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>
            Messaging unlocks once you both opt in. Here&apos;s how it works:
          </p>

          {/* How the loop works */}
          <div className="flex items-center justify-center gap-2 mb-7 flex-wrap">
            {[
              { icon: <UserPlus size={15} />, label: "You Connect" },
              { icon: <Check size={15} />, label: "They accept" },
              { icon: <MessageCircle size={15} />, label: "Chat unlocks" },
            ].map((s, i) => (
              <div key={s.label} className="flex items-center gap-2">
                <div
                  className="flex items-center gap-2 px-3 py-2 rounded-lg border text-xs font-medium"
                  style={{ borderColor: "var(--border)", color: "var(--text-primary)", backgroundColor: "var(--background)" }}
                >
                  <span style={{ color: "var(--accent)" }}>{s.icon}</span>
                  {s.label}
                </div>
                {i < 2 && <ArrowRight size={13} style={{ color: "var(--text-muted)" }} />}
              </div>
            ))}
          </div>

          <Link
            href="/dashboard/matches"
            className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Browse matches <ArrowRight size={14} />
          </Link>
        </div>
      )}

      {/* Incoming requests */}
      {incoming.length > 0 && (
        <Section title="Requests" count={incoming.length}>
          {incoming.map((c) => (
            <ConnectionRow key={c.match_id} c={c}>
              <button
                onClick={() => decide(c.other_user_id, true)}
                disabled={acting === c.other_user_id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs font-medium disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                {acting === c.other_user_id ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />} Accept
              </button>
              <button
                onClick={() => decide(c.other_user_id, false)}
                disabled={acting === c.other_user_id}
                className="flex items-center gap-1 px-3 py-1.5 rounded-lg text-xs border disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                <X size={12} /> Pass
              </button>
            </ConnectionRow>
          ))}
        </Section>
      )}

      {/* Connected */}
      {connected.length > 0 && (
        <Section title="Connected" count={connected.length}>
          {connected.map((c) => (
            <ConnectionRow key={c.match_id} c={c}>
              <button
                onClick={() => setActiveMatch(c.match_id)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                <MessageCircle size={12} /> Message
              </button>
            </ConnectionRow>
          ))}
        </Section>
      )}

      {/* Outgoing */}
      {outgoing.length > 0 && (
        <Section title="Sent" count={outgoing.length}>
          {outgoing.map((c) => (
            <ConnectionRow key={c.match_id} c={c}>
              <span className="flex items-center gap-1.5 text-xs" style={{ color: "var(--text-secondary)" }}>
                <Clock size={12} /> Pending
              </span>
            </ConnectionRow>
          ))}
        </Section>
      )}
    </div>
  );
}

function Section({ title, count, children }: { title: string; count: number; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h2 className="text-xs uppercase tracking-wider font-semibold" style={{ color: "var(--text-secondary)" }}>
        {title} · {count}
      </h2>
      <div className="flex flex-col gap-2">{children}</div>
    </section>
  );
}

function ConnectionRow({ c, children }: { c: Connection; children: React.ReactNode }) {
  const tierColor = TIER_COLOR[c.other_tier] ?? "var(--accent)";
  return (
    <div
      className="flex items-center gap-3 p-3 rounded-xl border card-hover"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <Link href={`/profile/${c.other_user_id}`}>
        <Avatar url={c.other_avatar} name={c.other_name} size={40} color={tierColor} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/profile/${c.other_user_id}`}
          className="text-sm font-semibold hover:underline truncate block"
          style={{ color: "var(--text-primary)" }}
        >
          {c.other_name}
        </Link>
        <div className="flex items-center gap-2 text-[11px]" style={{ color: "var(--text-secondary)" }}>
          {c.other_city && <span className="flex items-center gap-1"><MapPin size={9} /> {c.other_city}</span>}
          {c.other_tier && <span>{c.other_tier}</span>}
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">{children}</div>
    </div>
  );
}

export default function ConnectionsPage() {
  return (
    <Suspense fallback={null}>
      <ConnectionsInner />
    </Suspense>
  );
}
