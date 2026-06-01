"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, Loader2, ArrowRight, TrendingUp, Sparkles } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ScanCard } from "@/components/ScanCard";

type DomainMeta = { id: string; sensitivity: string; disclaimer: string; sections: string[] };
type Scan = { sections: Record<string, string>; signal: Record<string, string | boolean>; created_at?: string };
type Diff = { field: string; from: string | boolean; to: string | boolean };

const DOMAIN_LABEL: Record<string, string> = { career: "Career", relationships: "Relationships" };
const DOMAIN_BLURB: Record<string, string> = {
  career: "How you work and where you're headed — execution style, strengths, growth areas.",
  relationships: "A gentle, non-clinical mirror of how you tend to connect with people.",
};

function humanize(k: string) {
  const s = k.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

export default function ScansPage() {
  const { user } = useAuth();
  const [domains, setDomains] = useState<DomainMeta[]>([]);
  const [latest, setLatest] = useState<Record<string, Scan>>({});
  const [diffs, setDiffs] = useState<Record<string, Diff[]>>({});
  const [running, setRunning] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const loadTimeline = useCallback(async (domain: string) => {
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/me/timeline?domain=${domain}`);
      if (!r.ok) return;
      const d = await r.json();
      if (Array.isArray(d.diff) && d.diff.length > 0) {
        setDiffs((prev) => ({ ...prev, [domain]: d.diff }));
      }
    } catch { /* non-fatal */ }
  }, []);

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const [dRes, lRes] = await Promise.all([
        authedFetch(`${API_BASE_URL}/api/scan/domains`),
        authedFetch(`${API_BASE_URL}/api/scan/me`),
      ]);
      const dData = dRes.ok ? await dRes.json() : { domains: [] };
      const lData = lRes.ok ? await lRes.json() : { latest: {} };
      // Only the additional lenses here — the founder card lives on Overview.
      setDomains((dData.domains || []).filter((x: DomainMeta) => x.id !== "founder"));
      setLatest(lData.latest || {});
      Object.keys(lData.latest || {}).forEach((dom) => { if (dom !== "founder") loadTimeline(dom); });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Failed to load scans.");
    } finally {
      setLoading(false);
    }
  }, [user, loadTimeline]);

  useEffect(() => { load(); }, [load]);

  const runScan = async (domain: string) => {
    setRunning(domain);
    setError("");
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [domain] }),
      });
      const data = await r.json();
      const result = data.scans?.[domain];
      if (!result || result.error) {
        setError(result?.error || "Scan failed.");
        return;
      }
      setLatest((prev) => ({
        ...prev,
        [domain]: { sections: result.sections, signal: result.signal, created_at: new Date().toISOString() },
      }));
      loadTimeline(domain);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setRunning(null);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Your scans</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Run other lenses over the same digital brain. Your founder card lives on{" "}
          <Link href="/dashboard" className="hover:underline" style={{ color: "var(--accent)" }}>Overview</Link>.
        </p>
      </div>

      {error && (
        <p className="text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-3"
          style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
          <span>{error}</span>
          {error.toLowerCase().includes("upload") && (
            <Link href="/upload" className="font-medium whitespace-nowrap" style={{ color: "var(--accent)" }}>
              Upload →
            </Link>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-20">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : (
        <div className="flex flex-col gap-8">
          {domains.map((dom) => {
            const scan = latest[dom.id];
            const diff = diffs[dom.id];
            const busy = running === dom.id;
            return (
              <section key={dom.id} className="flex flex-col gap-3">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <h2 className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>
                      {DOMAIN_LABEL[dom.id] ?? dom.id}
                    </h2>
                    <p className="text-xs" style={{ color: "var(--text-secondary)" }}>{DOMAIN_BLURB[dom.id]}</p>
                  </div>
                  <button
                    onClick={() => runScan(dom.id)}
                    disabled={busy}
                    className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50 whitespace-nowrap"
                    style={{ backgroundColor: "var(--accent)", color: "white" }}
                  >
                    {busy ? <Loader2 size={14} className="animate-spin" /> : <ScanLine size={14} />}
                    {busy ? "Scanning…" : scan ? "Re-scan" : "Run scan"}
                  </button>
                </div>

                {/* Longitudinal diff — what shifted since last time */}
                {diff && diff.length > 0 && (
                  <div className="rounded-xl border p-4" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
                    <div className="flex items-center gap-2 mb-2 text-xs font-semibold" style={{ color: "var(--accent)" }}>
                      <TrendingUp size={13} /> What shifted since your last scan
                    </div>
                    <div className="flex flex-col gap-1.5">
                      {diff.map((c) => (
                        <div key={c.field} className="text-sm flex items-center gap-2" style={{ color: "var(--text-secondary)" }}>
                          <span style={{ color: "var(--text-primary)" }}>{humanize(c.field)}:</span>
                          <span style={{ textDecoration: "line-through", opacity: 0.6 }}>{String(c.from)}</span>
                          <ArrowRight size={12} />
                          <span className="font-semibold" style={{ color: "var(--accent)" }}>{String(c.to)}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {scan ? (
                  <ScanCard
                    domain={dom.id}
                    sections={scan.sections}
                    signal={scan.signal}
                    disclaimer={dom.disclaimer || undefined}
                    scannedAt={scan.created_at}
                  />
                ) : (
                  <div
                    className="rounded-2xl border border-dashed p-6"
                    style={{ borderColor: "var(--border)", backgroundColor: "var(--surface)" }}
                  >
                    {dom.disclaimer && (
                      <p className="text-xs mb-3" style={{ color: "#fbbf24" }}>{dom.disclaimer}</p>
                    )}
                    <div className="flex items-center gap-2 mb-3 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                      <Sparkles size={14} style={{ color: "var(--accent)" }} /> You&apos;ll get
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {dom.sections.map((s) => (
                        <span key={s} className="text-xs px-2.5 py-1 rounded-full"
                          style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
                          {s}
                        </span>
                      ))}
                    </div>
                  </div>
                )}
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}
