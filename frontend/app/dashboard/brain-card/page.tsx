"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, Loader2, Upload, RefreshCw, Brain } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ScanCard } from "@/components/ScanCard";
import { ScanStats } from "@/components/ScanStats";

type Scan = { sections: Record<string, string>; signal: Record<string, string | boolean>; created_at?: string };

const DOMAIN = "brainscan";

export default function BrainCardPage() {
  const { user } = useAuth();
  const [scan, setScan] = useState<Scan | null>(null);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/me`);
      const d = r.ok ? await r.json() : { latest: {} };
      setScan(d.latest?.[DOMAIN] ?? null);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => { load(); }, [load]);

  const run = async () => {
    setRunning(true);
    setError("");
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/me`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ domains: [DOMAIN] }),
      });
      const data = await r.json();
      const res = data.scans?.[DOMAIN];
      if (!res || res.error) {
        setError(res?.error || "Scan failed.");
        return;
      }
      setScan({ sections: res.sections, signal: res.signal, created_at: new Date().toISOString() });
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setRunning(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Your Brain Card</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          One scan of your digital brain — who you are, how you think, your career, and how you connect.
          It&apos;s what we use to find your people.
        </p>
      </div>

      {/* Uploads / brain source */}
      <ScanStats />

      <div
        className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-xl border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Brain size={20} style={{ color: "var(--accent)" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {scan ? "Refresh your Brain Card" : "Generate your Brain Card"}
            </div>
            <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
              Reads your uploaded digital brain. Re-upload first if your notes changed.
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border hover:border-[color:var(--accent)]"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <Upload size={14} /> Upload brain
          </Link>
          <button
            onClick={run}
            disabled={running}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {running ? <Loader2 size={14} className="animate-spin" /> : scan ? <RefreshCw size={14} /> : <ScanLine size={14} />}
            {running ? "Scanning…" : scan ? "Refresh" : "Generate"}
          </button>
        </div>
      </div>

      {error && (
        <p className="text-sm px-4 py-3 rounded-lg flex items-center justify-between gap-3"
          style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
          <span>{error}</span>
          {error.toLowerCase().includes("upload") && (
            <Link href="/upload" className="font-medium whitespace-nowrap" style={{ color: "var(--accent)" }}>Upload →</Link>
          )}
        </p>
      )}

      {loading ? (
        <div className="flex items-center justify-center py-16">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : scan ? (
        <ScanCard domain={DOMAIN} sections={scan.sections} signal={scan.signal} scannedAt={scan.created_at} />
      ) : (
        <div className="p-10 rounded-xl border text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <ScanLine size={30} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold mb-2" style={{ color: "var(--text-primary)" }}>No Brain Card yet</h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload your digital brain, then hit Generate — your Brain Card appears here and unlocks your people.
          </p>
        </div>
      )}
    </div>
  );
}
