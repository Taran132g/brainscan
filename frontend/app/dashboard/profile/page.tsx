"use client";

import { useEffect, useState, Suspense } from "react";
import { Save, CheckCircle, Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { ConnectGitHub } from "@/components/ConnectGitHub";
import { ConnectLinkedIn } from "@/components/ConnectLinkedIn";
import { ScanStats } from "@/components/ScanStats";

type ProfileFields = {
  full_name: string;
  age: string;
  city: string;
  willing_to_relocate: string;
  work_authorization: string;
  school: string;
  linkedin: string;
  github: string;
  twitter: string;
  website: string;
  gender: string;
  race: string;
  languages: string;
};

const EMPTY: ProfileFields = {
  full_name: "",
  age: "",
  city: "",
  willing_to_relocate: "",
  work_authorization: "",
  school: "",
  linkedin: "",
  github: "",
  twitter: "",
  website: "",
  gender: "",
  race: "",
  languages: "",
};

export default function ProfilePage() {
  const { user } = useAuth();
  const [fields, setFields] = useState<ProfileFields>(EMPTY);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    if (!user) return;
    const md = (user.user_metadata ?? {}) as Partial<ProfileFields>;
    setFields({ ...EMPTY, ...md });
  }, [user]);

  const update = (key: keyof ProfileFields, value: string) => {
    setFields((prev) => ({ ...prev, [key]: value }));
    setSaved(false);
  };

  const handleSave = async () => {
    setSaving(true);
    setError("");
    const { error: err } = await supabase.auth.updateUser({ data: fields });
    setSaving(false);
    if (err) {
      setError(err.message);
      return;
    }
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
  };

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Profile
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Fields used for co-founder matching. Required fields are flagged.
        </p>
      </div>

      <section className="flex flex-col gap-5">
        <ScanStats />

        <Suspense fallback={null}>
          <ConnectGitHub />
        </Suspense>

        <ConnectLinkedIn />

        <FieldGroup title="Required">
          <Field label="Full name" required>
            <input type="text" value={fields.full_name} onChange={(e) => update("full_name", e.target.value)} className={inputCls} placeholder="Taranveer Singh" />
          </Field>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Age" required>
              <input type="number" min="16" max="99" value={fields.age} onChange={(e) => update("age", e.target.value)} className={inputCls} placeholder="20" />
            </Field>
            <Field label="City" required>
              <input type="text" value={fields.city} onChange={(e) => update("city", e.target.value)} className={inputCls} placeholder="State College, PA" />
            </Field>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Field label="Willing to relocate?" required>
              <select value={fields.willing_to_relocate} onChange={(e) => update("willing_to_relocate", e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                <option value="yes">Yes</option>
                <option value="no">No</option>
                <option value="maybe">Maybe</option>
              </select>
            </Field>
            <Field label="Work authorization" required>
              <select value={fields.work_authorization} onChange={(e) => update("work_authorization", e.target.value)} className={inputCls}>
                <option value="">Select…</option>
                <option value="us_citizen">US citizen</option>
                <option value="us_permanent_resident">US permanent resident</option>
                <option value="us_visa">US visa (F-1, H-1B, etc.)</option>
                <option value="non_us">Non-US</option>
              </select>
            </Field>
          </div>
          <Field label="School / university">
            <input type="text" value={fields.school} onChange={(e) => update("school", e.target.value)} className={inputCls} placeholder="Penn State University" />
          </Field>
        </FieldGroup>

        <FieldGroup title="Online presence (optional but strongly recommended)">
          <Field label="GitHub username">
            <input type="text" value={fields.github} onChange={(e) => update("github", e.target.value)} className={inputCls} placeholder="Taran132g" />
          </Field>
          <Field label="LinkedIn URL">
            <input type="url" value={fields.linkedin} onChange={(e) => update("linkedin", e.target.value)} className={inputCls} placeholder="https://linkedin.com/in/..." />
          </Field>
          <Field label="Twitter / X">
            <input type="text" value={fields.twitter} onChange={(e) => update("twitter", e.target.value)} className={inputCls} placeholder="@handle" />
          </Field>
          <Field label="Personal website">
            <input type="url" value={fields.website} onChange={(e) => update("website", e.target.value)} className={inputCls} placeholder="https://yoursite.com" />
          </Field>
        </FieldGroup>

        <FieldGroup title="Demographics (optional — for profile display only, not used in matching algorithm)">
          <div className="grid grid-cols-2 gap-4">
            <Field label="Gender">
              <input type="text" value={fields.gender} onChange={(e) => update("gender", e.target.value)} className={inputCls} placeholder="optional" />
            </Field>
            <Field label="Race / ethnicity">
              <input type="text" value={fields.race} onChange={(e) => update("race", e.target.value)} className={inputCls} placeholder="optional" />
            </Field>
          </div>
          <Field label="Languages spoken">
            <input type="text" value={fields.languages} onChange={(e) => update("languages", e.target.value)} className={inputCls} placeholder="English, Punjabi, Hindi" />
          </Field>
        </FieldGroup>

        {/* Save button */}
        <div className="flex items-center justify-between pt-2">
          <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
            Saved to your account — visible only to you and people you match with.
          </p>
          <button
            onClick={handleSave}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 rounded-lg font-medium text-sm disabled:opacity-50"
            style={{ backgroundColor: saved ? "#10b981" : "var(--accent)", color: "white" }}
          >
            {saving ? <Loader2 size={14} className="animate-spin" /> : saved ? <CheckCircle size={14} /> : <Save size={14} />}
            {saving ? "Saving..." : saved ? "Saved" : "Save changes"}
          </button>
        </div>

        {error && (
          <p className="text-sm px-4 py-3 rounded-lg"
            style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
            {error}
          </p>
        )}
      </section>
    </div>
  );
}

const inputCls = "w-full px-3 py-2 rounded-lg text-sm outline-none border";

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-xs font-medium" style={{ color: "var(--text-secondary)" }}>
        {label}
        {required && <span style={{ color: "var(--accent)" }}> *</span>}
      </span>
      <div
        style={{
          backgroundColor: "var(--surface)",
          borderColor: "var(--border)",
          color: "var(--text-primary)",
          // hack: pass through styles to the child input via wrapper
        }}
        className="[&_input]:bg-transparent [&_input]:text-[color:var(--text-primary)] [&_input]:border-[color:var(--border)] [&_input]:bg-[color:var(--surface)] [&_select]:bg-[color:var(--surface)] [&_select]:text-[color:var(--text-primary)] [&_select]:border-[color:var(--border)]"
      >
        {children}
      </div>
    </label>
  );
}

function FieldGroup({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <div
      className="p-5 rounded-xl border flex flex-col gap-4"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {children}
    </div>
  );
}
