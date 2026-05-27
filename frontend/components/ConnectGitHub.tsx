"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Github, Check, Loader2, X, Star, GitBranch, Code, Info } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";

type GitHubStatus = {
  github_connected?: boolean;
  github_username?: string | null;
  github_quality?: "low" | "medium" | "high" | null;
  github_data?: {
    username?: string;
    avatar_url?: string;
    public_repo_count?: number;
    followers?: number;
    stats?: {
      non_fork_repos?: number;
      total_stars?: number;
      language_count?: number;
      languages?: string[];
    };
  } | null;
  github_connected_at?: string | null;
};

const QUALITY_COLOR: Record<string, string> = {
  high: "#10b981",
  medium: "#f59e0b",
  low: "#f87171",
};

export function ConnectGitHub() {
  const params = useSearchParams();
  const [status, setStatus] = useState<GitHubStatus | null>(null);
  const [username, setUsername] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const callbackMsg = (() => {
    if (params.get("github_connected") === "1") return { type: "success" as const, text: "GitHub connected." };
    const err = params.get("github_error");
    if (err) return { type: "error" as const, text: `GitHub error: ${err}` };
    return null;
  })();

  const load = async () => {
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/github/status`);
      if (!r.ok) throw new Error();
      setStatus(await r.json());
    } catch {
      setStatus({ github_connected: false });
    }
  };

  useEffect(() => { load(); }, []);

  const connect = async () => {
    const cleaned = username.trim().replace(/^@/, "").replace(/^https?:\/\/github\.com\//i, "");
    if (!cleaned) { setError("Enter your GitHub username."); return; }
    setBusy(true);
    setError("");
    try {
      const r = await authedFetch(`${API_BASE_URL}/api/github/lookup`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username: cleaned }),
      });
      if (!r.ok) {
        const d = await r.json().catch(() => ({}));
        throw new Error(typeof d.detail === "string" ? d.detail : "GitHub lookup failed");
      }
      await load();
      setUsername("");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not fetch GitHub data.");
    } finally {
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect GitHub? You'll need to reconnect before uploading.")) return;
    setBusy(true);
    try {
      await authedFetch(`${API_BASE_URL}/api/github/disconnect`, { method: "POST" });
      await load();
    } finally {
      setBusy(false);
    }
  };

  const connected = status?.github_connected;
  const data = status?.github_data;
  const stats = data?.stats;
  const quality = status?.github_quality;

  return (
    <div className="p-5 rounded-xl border flex flex-col gap-4"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3">
          <Github size={20} style={{ color: "var(--text-primary)" }} />
          <div>
            <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
              GitHub
            </h2>
            <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
              {connected
                ? `Connected as ${status?.github_username ?? data?.username ?? ""}`
                : "Required to upload your vault. We pull your public repos for the founder rank."}
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
        <div className="flex gap-2">
          <div
            className="flex-1 flex items-center gap-2 px-3 py-2 rounded-lg border"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)" }}
          >
            <span className="text-xs" style={{ color: "var(--text-secondary)" }}>github.com/</span>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") connect(); }}
              placeholder="your-handle"
              autoComplete="off"
              className="flex-1 bg-transparent text-sm outline-none"
              style={{ color: "var(--text-primary)" }}
              disabled={busy}
            />
          </div>
          <button
            onClick={connect}
            disabled={busy || !username.trim()}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {busy ? <Loader2 size={13} className="animate-spin" /> : <Github size={13} />}
            {busy ? "Fetching..." : "Connect"}
          </button>
        </div>
      )}

      {!connected && (
        <div className="flex items-start gap-2 text-[11px] px-3 py-2 rounded-lg"
          style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
          <Info size={11} style={{ flexShrink: 0, marginTop: 2 }} />
          <span>
            Self-reported for now (anyone could type any username). OAuth verification is coming.
            For now, we trust you to enter your own handle so we can fetch your actual public repos.
          </span>
        </div>
      )}

      {callbackMsg && (
        <div
          className="flex items-center gap-2 text-xs px-3 py-2 rounded-lg"
          style={{
            backgroundColor: callbackMsg.type === "success" ? "rgba(16,185,129,0.1)" : "rgba(248,113,113,0.1)",
            color: callbackMsg.type === "success" ? "#10b981" : "#f87171",
          }}
        >
          {callbackMsg.type === "success" ? <Check size={12} /> : <X size={12} />}
          {callbackMsg.text}
        </div>
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
            {quality && (
              <span className="text-xs font-semibold uppercase" style={{ color: QUALITY_COLOR[quality] }}>
                {quality}
              </span>
            )}
          </div>
          <div className="grid grid-cols-4 gap-3">
            <Stat icon={<GitBranch size={12} />} label="Repos" value={String(stats?.non_fork_repos ?? 0)} />
            <Stat icon={<Star size={12} />} label="Stars" value={String(stats?.total_stars ?? 0)} />
            <Stat icon={<Code size={12} />} label="Langs" value={String(stats?.language_count ?? 0)} />
            <Stat icon={<Github size={12} />} label="Followers" value={String(data.followers ?? 0)} />
          </div>
          {stats?.languages && stats.languages.length > 0 && (
            <div className="flex flex-wrap gap-1.5 pt-1">
              {stats.languages.slice(0, 8).map((l) => (
                <span key={l}
                  className="text-[10px] px-2 py-0.5 rounded-full"
                  style={{ backgroundColor: "var(--background)", color: "var(--text-secondary)" }}>
                  {l}
                </span>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function Stat({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1 px-3 py-2 rounded-lg" style={{ backgroundColor: "var(--background)" }}>
      <span className="flex items-center gap-1 text-[10px]" style={{ color: "var(--text-secondary)" }}>
        {icon} {label}
      </span>
      <span className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
