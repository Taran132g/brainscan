"use client";

import { useRef, useState } from "react";
import { Camera, Loader2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { Avatar } from "./Avatar";

/**
 * Profile-photo uploader. Pushes the file to the Supabase `avatars` bucket
 * (one file per user: avatars/<uid>/avatar), then persists the public URL to
 * both auth metadata (so the nav shows it without a fetch) and the profiles
 * table (so matches + the public card show it).
 */
export function AvatarUpload() {
  const { user } = useAuth();
  const md = (user?.user_metadata ?? {}) as Record<string, unknown>;
  const [url, setUrl] = useState<string | null>((md.avatar_url as string) ?? null);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState("");
  const inputRef = useRef<HTMLInputElement>(null);

  const name = (md.full_name as string) || user?.email || "You";

  const onFile = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;
    if (!file.type.startsWith("image/")) { setErr("Please choose an image file."); return; }
    if (file.size > 2 * 1024 * 1024) { setErr("Image must be under 2MB."); return; }

    setBusy(true);
    setErr("");
    try {
      const path = `${user.id}/avatar`;
      const { error: upErr } = await supabase.storage
        .from("avatars")
        .upload(path, file, { upsert: true, contentType: file.type });
      if (upErr) throw upErr;

      const { data } = supabase.storage.from("avatars").getPublicUrl(path);
      const publicUrl = `${data.publicUrl}?v=${Date.now()}`; // cache-bust the stable path

      await supabase.auth.updateUser({ data: { ...md, avatar_url: publicUrl } });
      await authedFetch(`${API_BASE_URL}/api/profile/me`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ avatar_url: publicUrl }),
      });
      setUrl(publicUrl);
    } catch (e) {
      setErr(e instanceof Error ? e.message : "Upload failed.");
    } finally {
      setBusy(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  };

  return (
    <div
      className="flex items-center gap-4 p-5 rounded-xl border"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="relative rounded-full group"
        title="Upload a profile photo"
      >
        <Avatar url={url} name={name} size={64} />
        <span
          className="absolute inset-0 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity"
          style={{ backgroundColor: "rgba(0,0,0,0.5)", color: "white" }}
        >
          {busy ? <Loader2 size={18} className="animate-spin" /> : <Camera size={18} />}
        </span>
      </button>

      <div className="flex-1 min-w-0">
        <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>Profile photo</div>
        <div className="text-xs" style={{ color: "var(--text-secondary)" }}>
          PNG, JPG, or WebP up to 2MB. Shows on your brain card and to people you match with.
        </div>
        {err && <div className="text-xs mt-1" style={{ color: "#f87171" }}>{err}</div>}
      </div>

      <button
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50 whitespace-nowrap hover:border-[color:var(--accent)]"
        style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
      >
        {busy ? "Uploading…" : url ? "Change photo" : "Upload photo"}
      </button>

      <input ref={inputRef} type="file" accept="image/*" hidden onChange={onFile} />
    </div>
  );
}
