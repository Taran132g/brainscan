"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { Loader2, MapPin, GraduationCap, Users, ArrowRight, ScanLine } from "lucide-react";
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

const DOMAINS = [
  { id: "career", label: "Career", color: "#3b82f6" },
  { id: "relationships", label: "Relationships", color: "#ec4899" },
] as const;

const MODES = [
  { id: "similar", label: "Similar", blurb: "Minds like yours" },
  { id: "complementary", label: "Complementary", blurb: "Minds that fill your gaps" },
] as const;

export default function PeoplePage() {
  const { user } = useAuth();
  const [domain, setDomain] = useState<string>("career");
  const [mode, setMode] = useState<string>("similar");
  const [people, setPeople] = useState<Person[] | null>(null);
  const [scannedDomains, setScannedDomains] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);

  const domainColor = DOMAINS.find((d) => d.id === domain)?.color ?? "var(--accent)";

  // Which domains has the user scanned? (drives the "scan first" empty state)
  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_BASE_URL}/api/scan/me`)
      .then((r) => (r.ok ? r.json() : { latest: {} }))
      .then((d) => setScannedDomains(new Set(Object.keys(d.latest || {}))))
      .catch(() => {});
  }, [user]);

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

      {/* Domain switcher */}
      <div className="flex flex-wrap items-center gap-2">
        {DOMAINS.map((d) => {
          const active = domain === d.id;
          return (
            <button
              key={d.id}
              onClick={() => setDomain(d.id)}
              className="px-4 py-2 rounded-lg text-sm font-medium border transition-colors"
              style={{
                borderColor: active ? d.color : "var(--border)",
                backgroundColor: active ? `${d.color}1f` : "transparent",
                color: active ? d.color : "var(--text-secondary)",
              }}
            >
              {d.label}
            </button>
          );
        })}
        <span className="mx-1 h-5 w-px" style={{ backgroundColor: "var(--border)" }} />
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
          title={`Run your ${domain} scan first`}
          body="We match you with people from your own brain scan. Run it once and your people show up here."
        />
      ) : !people || people.length === 0 ? (
        <EmptyState
          title="No one in the pool yet"
          body="You're early. As more people scan their brains, matches will appear here."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {people.map((p) => (
            <PersonCard key={p.user_id} person={p} color={domainColor} mode={mode} />
          ))}
        </div>
      )}
    </div>
  );
}

function PersonCard({ person, color, mode }: { person: Person; color: string; mode: string }) {
  return (
    <div
      className="flex items-start gap-4 p-5 rounded-xl border card-hover"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
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
  );
}

function EmptyState({ title, body }: { title: string; body: string }) {
  return (
    <div className="p-10 rounded-xl border text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <Users size={30} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
      <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>{title}</h2>
      <p className="text-sm max-w-md mx-auto mb-6" style={{ color: "var(--text-secondary)" }}>{body}</p>
      <Link
        href="/dashboard/scans"
        className="inline-flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm"
        style={{ backgroundColor: "var(--accent)", color: "white" }}
      >
        <ScanLine size={14} /> Go to scans <ArrowRight size={13} />
      </Link>
    </div>
  );
}
