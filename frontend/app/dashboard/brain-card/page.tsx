"use client";

import { useCallback, useEffect, useState } from "react";
import Link from "next/link";
import { ScanLine, Loader2, Upload, RefreshCw, Brain, Check, ArrowRight, FileJson } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { ScanStats } from "@/components/ScanStats";
import { ScanProcess } from "@/components/ScanProcess";

const DOMAIN = "brainscan";

export default function BrainCardPage() {
  const { user } = useAuth();
  const [hasCard, setHasCard] = useState(false);
  const [loading, setLoading] = useState(true);
  const [running, setRunning] = useState(false);
  const [error, setError] = useState("");

  const [importOpen, setImportOpen] = useState(false);
  const [importText, setImportText] = useState("");
  const [importing, setImporting] = useState(false);
  const [importMsg, setImportMsg] = useState("");

  const load = useCallback(async () => {
    if (!user) return;
    setLoading(true);
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/me`);
      const d = r.ok ? await r.json() : { latest: {} };
      setHasCard(!!d.latest?.[DOMAIN]);
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
      setHasCard(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Scan failed.");
    } finally {
      setRunning(false);
    }
  };

  const importCard = async () => {
    setImporting(true);
    setImportMsg("");
    let payload: unknown;
    try {
      payload = JSON.parse(importText);
    } catch {
      setImportMsg("That's not valid JSON — paste the output of scan_local.py.");
      setImporting(false);
      return;
    }
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/scan/import`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        setImportMsg(d.detail || "Import failed — check the card format.");
        return;
      }
      setHasCard(true);
      setImportText("");
      setImportOpen(false);
      setImportMsg("");
    } catch {
      setImportMsg("Import failed — try again.");
    } finally {
      setImporting(false);
    }
  };

  return (
    <div className="flex flex-col gap-6">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>Your Brain Card</h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Generate or refresh the whole-person scan of your digital brain. Your card itself lives on your{" "}
          <Link href="/dashboard" className="hover:underline" style={{ color: "var(--accent)" }}>Overview</Link>.
        </p>
      </div>

      {/* Uploads / brain source */}
      <ScanStats />

      {/* Generate / refresh */}
      <div
        className="flex flex-wrap items-center justify-between gap-3 p-5 rounded-xl border"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div className="flex items-center gap-3">
          <Brain size={20} style={{ color: "var(--accent)" }} />
          <div>
            <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              {hasCard ? "Refresh your Brain Card" : "Generate your Brain Card"}
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
            {running ? <Loader2 size={14} className="animate-spin" /> : hasCard ? <RefreshCw size={14} /> : <ScanLine size={14} />}
            {running ? "Scanning…" : hasCard ? "Refresh" : "Generate"}
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

      {/* Result state — the card itself shows on Overview */}
      {loading ? (
        <div className="flex items-center justify-center py-10">
          <Loader2 size={22} className="animate-spin" style={{ color: "var(--accent)" }} />
        </div>
      ) : hasCard ? (
        <Link
          href="/dashboard"
          className="flex items-center justify-between gap-3 p-5 rounded-xl border card-hover"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <span className="flex items-center gap-2 text-sm font-medium" style={{ color: "var(--text-primary)" }}>
            <Check size={16} style={{ color: "var(--accent)" }} /> Your Brain Card is ready — view it on Overview
          </span>
          <ArrowRight size={16} style={{ color: "var(--accent)" }} />
        </Link>
      ) : (
        <div className="p-8 rounded-xl border text-center" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
          <ScanLine size={28} className="mx-auto mb-3" style={{ color: "var(--accent)" }} />
          <h2 className="text-base font-semibold mb-1" style={{ color: "var(--text-primary)" }}>No Brain Card yet</h2>
          <p className="text-sm max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Upload your digital brain and hit Generate — your card appears on your Overview.
          </p>
        </div>
      )}

      {/* Free import — run the open-source scan yourself, paste the result */}
      <div className="rounded-xl border" style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <button
          onClick={() => setImportOpen((o) => !o)}
          className="w-full flex items-center justify-between gap-3 p-5 text-left"
        >
          <span className="flex items-center gap-2 text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            <FileJson size={16} style={{ color: "var(--accent)" }} /> Import a card you ran yourself (free)
          </span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{importOpen ? "Hide" : "Show"}</span>
        </button>
        {importOpen && (
          <div className="px-5 pb-5 flex flex-col gap-3">
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              Prefer to run it yourself? Clone the{" "}
              <a href="https://github.com/Taran132g/brainscan" target="_blank" rel="noreferrer" className="hover:underline" style={{ color: "var(--accent)" }}>
                open-source repo
              </a>
              , add your own API keys, and run{" "}
              <code style={{ backgroundColor: "var(--background)", padding: "1px 5px", borderRadius: 4 }}>
                python scripts/scan_local.py /path/to/your/vault
              </code>
              . Paste the JSON it prints below to store your card here for free.
            </p>
            <textarea
              value={importText}
              onChange={(e) => setImportText(e.target.value)}
              placeholder='{ "sections": { ... }, "signal": { ... } }'
              rows={6}
              className="w-full rounded-lg border p-3 text-xs font-mono"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
            />
            {importMsg && <p className="text-xs" style={{ color: "#f87171" }}>{importMsg}</p>}
            <div className="flex">
              <button
                onClick={importCard}
                disabled={importing || !importText.trim()}
                className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                {importing ? <Loader2 size={13} className="animate-spin" /> : <FileJson size={13} />} Import card
              </button>
            </div>
          </div>
        )}
      </div>

      <ScanProcess />
    </div>
  );
}
