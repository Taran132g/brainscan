"use client";

import { useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Github, Check, Loader2, X, Star, GitBranch, Code } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { supabase } from "@/lib/supabase";

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
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [syncing, setSyncing] = useState(false);
  const syncedRef = useRef(false);

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

  // After Supabase OAuth completes, we get a session with `provider_token`
  // briefly. Capture it and forward to the backend to fetch GitHub data.
  // (Provider tokens aren't persisted by Supabase — we have a small window.)
  useEffect(() => {
    const trySync = async (sessionLike: { provider_token?: string | null } | null) => {
      if (!sessionLike?.provider_token || syncedRef.current) return;
      syncedRef.current = true;
      setSyncing(true);
      setError("");
      try {
        const r = await authedFetch(`${API_BASE_URL}/api/github/sync`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ access_token: sessionLike.provider_token }),
        });
        if (!r.ok) {
          const d = await r.json().catch(() => ({}));
          throw new Error(typeof d.detail === "string" ? d.detail : "Sync failed");
        }
        await load();
      } catch (e) {
        setError(e instanceof Error ? e.message : "Failed to sync GitHub data");
        syncedRef.current = false;
      } finally {
        setSyncing(false);
      }
    };

    // Check current session on mount (handles the case where we just returned from OAuth)
    supabase.auth.getSession().then(({ data }) => trySync(data.session));

    // Also listen for auth state changes (USER_UPDATED fires after linkIdentity)
    const { data: sub } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "USER_UPDATED" || event === "SIGNED_IN" || event === "TOKEN_REFRESHED") {
        trySync(session);
      }
    });
    return () => sub.subscription.unsubscribe();
  }, []);

  const connect = async () => {
    setBusy(true);
    setError("");
    syncedRef.current = false;
    try {
      // Supabase handles the GitHub OAuth dance via its own callback URL
      // (configured in Supabase Auth Providers → GitHub). User bounces to
      // GitHub, approves, comes back here with provider_token in the session.
      const { error: err } = await supabase.auth.linkIdentity({
        provider: "github",
        options: {
          scopes: "read:user public_repo",
          redirectTo: window.location.href,
        },
      });
      if (err) throw err;
      // linkIdentity triggers a full-page redirect to GitHub.
      // (If it returns without redirecting, something failed silently.)
    } catch (e) {
      setError(e instanceof Error ? e.message : "Could not start GitHub OAuth.");
      setBusy(false);
    }
  };

  const disconnect = async () => {
    if (!confirm("Disconnect GitHub? Your founder rank will drop until you reconnect.")) return;
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
                : "Required to upload your vault — we use real GitHub data to grade your founder rank."}
            </p>
          </div>
        </div>
        {connected ? (
          <button
            onClick={disconnect}
            disabled={busy}
            className="text-xs px-3 py-1.5 rounded-lg border disabled:opacity-50"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            Disconnect
          </button>
        ) : (
          <button
            onClick={connect}
            disabled={busy || syncing}
            className="flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            {busy || syncing ? <Loader2 size={13} className="animate-spin" /> : <Github size={13} />}
            {syncing ? "Fetching repos..." : "Connect GitHub"}
          </button>
        )}
      </div>

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
              Quality grade
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
