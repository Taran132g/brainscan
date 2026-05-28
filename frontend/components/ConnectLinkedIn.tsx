"use client";

import { useEffect, useState } from "react";
import { Linkedin, Check, Loader2, X, Info, Briefcase } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";

type LinkedInStatus = {
  linkedin_connected?: boolean;
  linkedin?: string | null;
  linkedin_quality?: "low" | "medium" | "high" | null;
  big_tech_employer?: boolean | null;
  linkedin_data?: {
    url?: string;
    latest_company?: string;
    latest_role?: string;
    previous_employers?: string;
    years_experience?: number;
  } | null;
};

const QUALITY_COLOR: Record<string, string> = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#f87171",
};

export function ConnectLinkedIn() {
  const [status, setStatus] = useState<LinkedInStatus | null>(null);
  const [url, setUrl] = useState("");
  const [latestCompany, setLatestCompany] = useState("");
  const [latestRole, setLatestRole] = useState("");
  const [previousEmployers, setPreviousEmployers] = useState("");
  const [yearsExperience, setYearsExperience] = useState("");
  const [showOptionals, setShowOptionals] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const load = async () => {
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/linkedin/status`);
      if (!r.ok) throw new Error();
      setStatus(await r.json());
    } catch {
      setStatus({ linkedin_connected: false });
    }
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    if (!url.trim()) { setError("Enter your LinkedIn URL."); return; }
    setBusy(true);
    setError("");
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/linkedin/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          linkedin_url: url.trim(),
          latest_company: latestCompany.trim() || undefined,
          latest_role: latestRole.trim() || undefined,
          previous_employers: previousEmployers.trim() || undefined,
          years_experience: yearsExperience.trim() ? parseInt(yearsExperience) : undefined,
        }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(typeof d.detail === "string" ? d.detail : "LinkedIn save failed");
      }
      await load();
      // Clear form
      setUrl("");
      setLatestCompany("");
      setLatestRole("");
      setPreviousEmployers("");
      setYearsExperience("");
      setShowOptionals(false);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not save LinkedIn.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect LinkedIn? Your founder rank may drop.")) return;
    setBusy(true);
    try {
      await authedFetch(`${API_BASE_URL}/api/linkedin/disconnect`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.linkedin_connected;
  const quality = status?.linkedin_quality;
  const data = status?.linkedin_data;
  const bigTech = status?.big_tech_employer;

  return (
    <div className="p-5 rounded-xl border flex flex-col gap-4"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Linkedin size={20} style={{ color: "var(--text-primary)" }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              LinkedIn
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {connected
                ? `Connected: ${status?.linkedin ?? ""}`
                : "Optional — adds employer prestige to your founder rank."}
            </p>
          </div>
        </div>
        {connected && (
          <button
            onClick={disconnect}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Disconnect
          </button>
        )}
      </div>

      {!connected && (
        <>
          <div className="flex flex-col gap-2">
            <input
              type="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://linkedin.com/in/your-handle"
              className="px-3 py-2 rounded-lg text-sm outline-none border"
              style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              disabled={busy}
            />

            {!showOptionals ? (
              <button
                onClick={() => setShowOptionals(true)}
                className="text-xs self-start hover:underline"
                style={{ color: "var(--accent)" }}
              >
                + Add employer info (improves your rank)
              </button>
            ) : (
              <div className="flex flex-col gap-2 pt-1">
                <div className="grid grid-cols-2 gap-2">
                  <input
                    type="text"
                    value={latestCompany}
                    onChange={(e) => setLatestCompany(e.target.value)}
                    placeholder="Latest company (e.g. Google)"
                    className="px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    disabled={busy}
                  />
                  <input
                    type="text"
                    value={latestRole}
                    onChange={(e) => setLatestRole(e.target.value)}
                    placeholder="Latest role (e.g. Software Engineer)"
                    className="px-3 py-2 rounded-lg text-sm outline-none border"
                    style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                    disabled={busy}
                  />
                </div>
                <input
                  type="text"
                  value={previousEmployers}
                  onChange={(e) => setPreviousEmployers(e.target.value)}
                  placeholder="Previous employers (comma-separated)"
                  className="px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  disabled={busy}
                />
                <input
                  type="number"
                  value={yearsExperience}
                  onChange={(e) => setYearsExperience(e.target.value)}
                  placeholder="Years of professional experience"
                  min="0"
                  max="60"
                  className="px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                  disabled={busy}
                />
              </div>
            )}

            <button
              onClick={connect}
              disabled={busy || !url.trim()}
              className="flex items-center justify-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50 mt-1"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              {busy ? <Loader2 size={13} className="animate-spin" /> : <Linkedin size={13} />}
              {busy ? "Saving..." : "Save LinkedIn"}
            </button>
          </div>

          <div className="flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg"
            style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
            <Info size={11} style={{ flexShrink: 0, marginTop: 2 }} />
            <span>
              Self-reported. LinkedIn doesn&apos;t allow public API lookups, so we grade based on what you tell us.
              Adding employer info bumps your rank if you&apos;ve worked at recognized companies.
            </span>
          </div>
        </>
      )}

      {error && (
        <p className="text-xs px-3 py-2 rounded-lg"
          style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
          {error}
        </p>
      )}

      {connected && data && (
        <div className="flex flex-col gap-3 pt-3 border-t" style={{ borderColor: "var(--border)" }}>
          <div className="flex items-center justify-between">
            <span className="text-[10px] uppercase tracking-wider" style={{ color: "var(--text-secondary)" }}>
              Quality grade · self-reported
            </span>
            <div className="flex items-center gap-2">
              {bigTech && (
                <span className="text-[10px] px-2 py-0.5 rounded-full font-semibold"
                  style={{ backgroundColor: "rgba(99,102,241,0.15)", color: "var(--accent)" }}>
                  Big-tech ✓
                </span>
              )}
              {quality && (
                <span className="text-xs font-semibold uppercase" style={{ color: QUALITY_COLOR[quality] }}>
                  {quality}
                </span>
              )}
            </div>
          </div>
          {(data.latest_company || data.latest_role || data.years_experience) && (
            <div className="flex flex-col gap-1.5 px-3 py-2 rounded-lg"
              style={{ backgroundColor: "var(--background)" }}>
              {data.latest_role && data.latest_company && (
                <div className="flex items-center gap-2 text-xs" style={{ color: "var(--text-primary)" }}>
                  <Briefcase size={11} style={{ color: "var(--accent)" }} />
                  {data.latest_role} @ {data.latest_company}
                </div>
              )}
              {data.previous_employers && (
                <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  Previously: {data.previous_employers}
                </div>
              )}
              {data.years_experience != null && (
                <div className="text-[11px]" style={{ color: "var(--text-secondary)" }}>
                  {data.years_experience} years experience
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
