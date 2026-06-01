"use client";

import { useState } from "react";
import { Instagram, Check, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { API_BASE_URL, authedFetch } from "@/lib/api";

/**
 * Instagram handle connection. Self-reported (like GitHub/LinkedIn) — weights
 * the relationship/social side of the Brain Card and adds to verification.
 */
export function ConnectInstagram() {
  const { user } = useAuth();
  const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const [handle, setHandle] = useState((md.instagram as string) || "");
  const [connected, setConnected] = useState(!!(md.instagram));
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");

  const save = async () => {
    const clean = handle.trim().replace(/^@/, "");
    if (!clean) { setErr("Enter your handle."); return; }
    setBusy(true);
    setErr("");
    try {
      await supabase.auth.updateUser({ data: { ...md, instagram: clean } });
      await authedFetch(`${API_BASE_URL}/api/profile/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ instagram: clean }),
      });
      setHandle(clean);
      setConnected(true);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Could not save.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div
      className="p-5 rounded-xl border"
      style={{ backgroundColor: "var(--surface)", borderColor: connected ? "#ec4899" : "var(--border)" }}
    >
      <div className="flex items-center gap-3 mb-3">
        <Instagram size={18} style={{ color: connected ? "#ec4899" : "var(--text-secondary)" }} />
        <div>
          <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Instagram {connected ? "connected" : "(optional)"}
          </h2>
          <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
            Weights the relationship side of your Brain Card and boosts credibility.
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <div className="relative flex-1">
          <span className="absolute left-3 top-1/2 -translate-y-1/2 text-sm" style={{ color: "var(--text-secondary)" }}>@</span>
          <input
            value={handle.replace(/^@/, "")}
            onChange={(e) => { setHandle(e.target.value); setConnected(false); }}
            placeholder="yourhandle"
            className="w-full pl-7 pr-3 py-2 rounded-lg text-sm outline-none border"
            style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
          />
        </div>
        <button
          onClick={save}
          disabled={busy}
          className="flex items-center gap-1.5 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ backgroundColor: connected ? "#ec4899" : "var(--accent)", color: "white" }}
        >
          {busy ? <Loader2 size={13} className="animate-spin" /> : connected ? <Check size={13} /> : null}
          {connected ? "Saved" : "Connect"}
        </button>
      </div>
      {err && <p className="text-xs mt-2" style={{ color: "#f87171" }}>{err}</p>}
    </div>
  );
}
