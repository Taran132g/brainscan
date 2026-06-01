"use client";

import { useEffect, useState } from "react";
import { Loader2, Globe, Lock, Users } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";

// The whole-person Brain Card sections (BRAINSCAN domain). Users can hide any
// of these from what others see.
const SECTIONS = [
  "Who They Are",
  "How They Think",
  "Career & Ambition",
  "How They Connect",
  "Values & What Drives Them",
  "What They're Looking For",
];

type Privacy = {
  profile_public: boolean;
  hidden_sections: string[];
  matching_enabled: boolean;
};

export function PrivacyControls() {
  const [p, setP] = useState<Privacy | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    authedFetch(`${API_BASE_URL}/api/profile/me/privacy`)
      .then((r) => (r.ok ? r.json() : null))
      .then((d) => {
        if (!d) return;
        setP({
          profile_public: d.profile_public ?? true,
          hidden_sections: Array.isArray(d.hidden_sections) ? d.hidden_sections : [],
          matching_enabled: d.matching_enabled ?? true,
        });
      })
      .catch(() => {});
  }, []);

  const save = async (patch: Partial<Privacy>) => {
    setP((prev) => (prev ? { ...prev, ...patch } : prev)); // optimistic
    setSaving(true);
    try {
      await authedFetch(`${API_BASE_URL}/api/profile/me/privacy`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(patch),
      });
    } catch {
      /* keep optimistic state */
    } finally {
      setSaving(false);
    }
  };

  const toggleSection = (s: string) => {
    if (!p) return;
    const hidden = p.hidden_sections.includes(s)
      ? p.hidden_sections.filter((x) => x !== s)
      : [...p.hidden_sections, s];
    save({ hidden_sections: hidden });
  };

  if (!p) {
    return (
      <p className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
        <Loader2 size={12} className="animate-spin" /> Loading your settings…
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <ToggleRow
        icon={p.profile_public ? <Globe size={15} /> : <Lock size={15} />}
        label="Public profile"
        desc="Anyone with your link can view your Brain Card. Off = only you can see it."
        on={p.profile_public}
        onChange={(v) => save({ profile_public: v })}
      />
      <ToggleRow
        icon={<Users size={15} />}
        label="Show me in matching"
        desc="Appear on the People page and be matchable. Off removes you from the pool."
        on={p.matching_enabled}
        onChange={(v) => save({ matching_enabled: v })}
      />

      <div className="px-4 py-3 rounded-lg" style={{ backgroundColor: "var(--background)" }}>
        <div className="text-sm mb-1" style={{ color: "var(--text-primary)" }}>
          Sections shown on your public card
        </div>
        <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
          You always see every section. Uncheck any you don&apos;t want others to see.
        </p>
        <div className="flex flex-col gap-2">
          {SECTIONS.map((s) => {
            const shown = !p.hidden_sections.includes(s);
            return (
              <label
                key={s}
                className="flex items-center gap-2.5 text-sm cursor-pointer select-none"
                style={{ color: shown ? "var(--text-primary)" : "var(--text-secondary)" }}
              >
                <input
                  type="checkbox"
                  checked={shown}
                  onChange={() => toggleSection(s)}
                  style={{ accentColor: "var(--accent)", width: 15, height: 15 }}
                />
                <span>{s}</span>
                {!shown && (
                  <span className="text-xs" style={{ color: "var(--text-muted)" }}>
                    · hidden
                  </span>
                )}
              </label>
            );
          })}
        </div>
      </div>

      <div className="h-4">
        {saving && (
          <span className="text-xs flex items-center gap-1.5" style={{ color: "var(--text-secondary)" }}>
            <Loader2 size={11} className="animate-spin" /> Saving…
          </span>
        )}
      </div>
    </div>
  );
}

function ToggleRow({
  icon,
  label,
  desc,
  on,
  onChange,
}: {
  icon: React.ReactNode;
  label: string;
  desc: string;
  on: boolean;
  onChange: (v: boolean) => void;
}) {
  return (
    <div
      className="flex items-center justify-between gap-4 px-4 py-3 rounded-lg"
      style={{ backgroundColor: "var(--background)" }}
    >
      <div className="flex items-start gap-2.5 min-w-0">
        <span className="mt-0.5" style={{ color: "var(--text-secondary)" }}>{icon}</span>
        <div className="min-w-0">
          <div className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{label}</div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>{desc}</div>
        </div>
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={on}
        aria-label={label}
        onClick={() => onChange(!on)}
        className="relative shrink-0 rounded-full transition-colors"
        style={{
          width: 42,
          height: 24,
          backgroundColor: on ? "var(--accent)" : "rgba(148,163,184,0.35)",
        }}
      >
        <span
          className="absolute top-1/2 rounded-full bg-white transition-all"
          style={{ width: 18, height: 18, transform: "translateY(-50%)", left: on ? 21 : 3 }}
        />
      </button>
    </div>
  );
}
