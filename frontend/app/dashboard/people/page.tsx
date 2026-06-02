"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, GraduationCap, Users, ArrowRight, ScanLine, UserPlus, Check } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { Avatar } from "@/components/Avatar";

type Person = {
  user_id: string;
  score: number;
  name: string;
  city: string;
  school: string;
  avatar_url?: string | null;
  preview: string;
};

const MODES = [
  { id: "similar", label: "Similar", blurb: "Minds like yours" },
  { id: "complementary", label: "Complementary", blurb: "Minds that fill your gaps" },
] as const;

const DOMAIN = "brainscan";

export default function PeoplePage() {
  const { user } = useAuth();
  const [mode, setMode] = useState<string>("similar");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [scannedDomains, setScannedDomains] = useState<Set<string>>(new Set());
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loading, setLoading] = useState(true);

  const domain = DOMAIN;
  const domainColor = "var(--accent)";

  // Which domains has the user scanned? (drives the "scan first" empty state)
  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_BASE_URL}/api/scan/me`)
      .then((r) => (r.ok ? r.json() : { latest: {} }))
      .then((d) => setScannedDomains(new Set(Object.keys(d.latest || {}))))
      .catch(() => {});
  }, [user]);

  // Existing connection statuses, so each card shows the right button.
  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_BASE_URL}/api/match/connections`)
      .then((r) => (r.ok ? r.json() : { connections: [] }))
      .then((d) => {
        const m: Record<string, string> = {};
        (d.connections || []).forEach((c: { other_user_id: string; status: string }) => {
          m[c.other_user_id] = c.status;
        });
        setStatuses(m);
      })
      .catch(() => {});
  }, [user]);

  const connect = useCallback(async (otherId: string) => {
    setStatuses((s) => ({ ...s, [otherId]: "pending_outgoing" })); // optimistic
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/match/${otherId}/connect`, { method: "POST" });
      if (!r.ok) {
        // e.g. the pool member isn't a real account yet — don't fake "sent".
        setStatuses((s) => ({ ...s, [otherId]: "none" }));
        return;
      }
      const d = await r.json();
      setStatuses((s) => ({ ...s, [otherId]: d.status || "pending_outgoing" }));
    } catch {
      setStatuses((s) => ({ ...s, [otherId]: "none" }));
    }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/people?domain=${domain}&mode=${mode}`);
      const d = r.ok ? await r.json() : { people: [] };
      setPeople(d.people || []);
    } catch {
      setPeople([]);
    } finally {
      setLoading(false);
    }
  }, [user, domain, mode]);

  useEffect(() => { load(); }, [load]);

  const hasScanned = scannedDomains.has(domain);

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>People</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Meet people matched on how they actually think — read from their brain scans.
        </p>
      </div>

      {/* Similar / complementary toggle */}
      <div className="flex flex-wrap items-center gap-2">
        {MODES.map((m) => {
          const active = mode === m.id;
          return (
            <button
              key={m.id}
              onClick={() => setMode(m.id)}
              title={m.blurb}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: active ? "var(--accent)" : "var(--border)",
                backgroundColor: active ? "var(--accent-glow)" : "transparent",
                color: active ? "var(--accent)" : "var(--text-secondary)",
              }}
            >
              {m.label}
            </button>
          );
        })}
      </div>
      <p className="-mt-3 text-xs" style={{ color: "var(--text-muted)" }}>
        {MODES.find((m) => m.id === mode)?.blurb}.
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : !hasScanned ? (
        <EmptyState
          title="Generate your Brain Card first"
          body="We match you with people from your own Brain Card. Generate it once and your people show up here."
        />
      ) : !people || people.length === 0 ? (
        <EmptyState
          title="No one in the pool yet"
          body="You're early. As more people scan their brains, matches will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {people.map((p) => (
            <PersonCard
              key={p.user_id}
              person={p}
              color={domainColor}
              mode={mode}
              status={statuses[p.user_id] || "none"}
              onConnect={connect}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({
  person,
  color,
  mode,
  status,
  onConnect,
}: {
  person: Person;
  color: string;
  mode: string;
  status: string;
  onConnect: (id: string) => void;
}) {
  return (
    <div
      className="flex flex-col gap-3 p-5 rounded-xl border card-hover"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-start gap-4">
        <Avatar url={person.avatar_url} name={person.name} size={48} color={color} />
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between gap-2 mb-1">
            <h3 className="text-base font-semibold truncate" style={{ color: "var(--text-primary)" }}>{person.name}</h3>
            <span className="text-xs font-semibold whitespace-nowrap" style={{ color }}>
              {person.score}% {mode === "complementary" ? "complement" : "match"}
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-3 text-[11px] mb-2" style={{ color: "var(--text-secondary)" }}>
            {person.city && <span className="flex items-center gap-1"><MapPin size={10} /> {person.city}</span>}
            {person.school && <span className="flex items-center gap-1"><GraduationCap size={10} /> {person.school}</span>}
          </div>
          {person.preview && (
            <p className="text-xs leading-relaxed line-clamp-2" style={{ color: "var(--text-secondary)" }}>{person.preview}</p>
          )}
        </div>
      </div>

      <div className="flex items-center gap-2">
        <Link
          href={`/profile/${person.user_id}`}
          className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium border hover:border-[color:var(--accent)]"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          View card
        </Link>
        {status === "connected" ? (
          <Link
            href="/dashboard/connections"
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "var(--accent-glow)", color: "var(--accent)" }}
          >
            <Check size={13} /> Connected · Message
          </Link>
        ) : status === "pending_outgoing" ? (
          <span
            className="flex-1 text-center px-3 py-2 rounded-lg text-xs font-medium"
            style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}
          >
            Request sent
          </span>
        ) : (
          <button
            onClick={() => onConnect(person.user_id)}
            className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-xs font-semibold"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            <UserPlus size={13} /> {status === "pending_incoming" ? "Accept" : "Connect"}
          </button>
        )}
      </div>
    </div>
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-10 rounded-xl border text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <Users size={30} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
      <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>{body}</p>
      <Link
        href="/dashboard/brain-card"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
        style={{ backgroundColor: "var(--accent)", color: "white" }}
      >
        <ScanLine size={14} /> Go to Brain Card <ArrowRight size={13} />
      </Link>
    </div>
  );
}
