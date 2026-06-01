"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import {
  Brain, ArrowRight, ArrowLeft, Loader2, Code2, Megaphone, Palette,
  Microscope, Sparkles, MapPin, GraduationCap, ShieldCheck, Check,
} from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { API_BASE_URL, authedFetch } from "@/lib/api";

type Role = "technical" | "business" | "design" | "domain";

const ROLES: { value: Role; label: string; sub: string; icon: React.ReactNode }[] = [
  { value: "technical", label: "Technical", sub: "I build the product", icon: <Code2 size={22} /> },
  { value: "business", label: "Business / GTM", sub: "I find the customers", icon: <Megaphone size={22} /> },
  { value: "design", label: "Design / UX", sub: "I shape how it feels", icon: <Palette size={22} /> },
  { value: "domain", label: "Domain expert", sub: "I know the industry cold", icon: <Microscope size={22} /> },
];

// One step per screen — conversational, with a progress bar.
const TOTAL_STEPS = 6; // 0..4 questions, 5 = teaser

export default function OnboardingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [step, setStep] = useState(0);
  const [saving, setSaving] = useState(false);

  const [fullName, setFullName] = useState("");
  const [role, setRole] = useState<Role | "">("");
  const [building, setBuilding] = useState("");
  const [need, setNeed] = useState("");
  const [city, setCity] = useState("");

  // Guard: not signed in → auth. Already onboarded → straight to dashboard.
  useEffect(() => {
    if (loading) return;
    if (!user) { router.replace("/auth"); return; }
    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    if (md.onboarded) { router.replace("/dashboard"); return; }
    // Pre-fill anything we already know
    setFullName((md.full_name as string) || "");
    setRole((md.role as Role) || "");
    setCity((md.city as string) || "");
  }, [user, loading, router]);

  const finish = async (skip = false) => {
    if (!user) return;
    setSaving(true);
    const md = (user.user_metadata ?? {}) as Record<string, unknown>;
    const data = {
      ...md,
      onboarded: true,
      ...(skip ? {} : {
        full_name: fullName || md.full_name,
        role,
        building,
        need,
        city: city || md.city,
      }),
    };
    await supabase.auth.updateUser({ data });
    if (!skip && (fullName || city)) {
      try {
        await authedFetch(`${API_BASE_URL}/api/profile/me`, {
          method: "PUT",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ full_name: fullName, city }),
        });
      } catch { /* non-fatal */ }
    }
    router.replace("/upload");
  };

  if (loading || !user) {
    return (
      <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex items-center justify-center">
        <Brain size={30} className="animate-pulse" style={{ color: "var(--accent)" }} />
      </div>
    );
  }

  const canAdvance =
    step === 0 ? fullName.trim().length > 0 :
    step === 1 ? role !== "" :
    true; // building / need / city are optional but encouraged

  const next = () => setStep((s) => Math.min(s + 1, TOTAL_STEPS - 1));
  const back = () => setStep((s) => Math.max(s - 1, 0));

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex flex-col">
      {/* Top bar: brand + progress + skip */}
      <div className="flex items-center justify-between px-6 py-5">
        <div className="flex items-center gap-2">
          <Brain size={20} style={{ color: "var(--accent)" }} />
          <span className="font-semibold font-display" style={{ color: "var(--text-primary)" }}>BrainScan</span>
        </div>
        <button
          onClick={() => finish(true)}
          disabled={saving}
          className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-xs font-medium border hover:border-[color:var(--accent)] disabled:opacity-50"
          style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          title="Skip the questions and upload your digital brain now"
        >
          Skip — I have a digital brain <ArrowRight size={13} />
        </button>
      </div>

      {/* Progress bar */}
      <div className="px-6">
        <div className="h-1 rounded-full overflow-hidden" style={{ backgroundColor: "var(--surface-2)" }}>
          <div
            className="h-full rounded-full transition-all duration-500"
            style={{ width: `${((step + 1) / TOTAL_STEPS) * 100}%`, backgroundColor: "var(--accent)" }}
          />
        </div>
      </div>

      <div className="flex-1 flex flex-col items-center justify-center px-6 py-10">
        <div key={step} className="w-full max-w-lg animate-in">
          {/* Step 0 — Name */}
          {step === 0 && (
            <Q label="First, what should we call you?" hint="This shows on your scans and to people you match with.">
              <input
                autoFocus
                value={fullName}
                onChange={(e) => setFullName(e.target.value)}
                onKeyDown={(e) => e.key === "Enter" && canAdvance && next()}
                placeholder="Taranveer Singh"
                className="w-full px-4 py-3 rounded-xl text-lg outline-none border"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </Q>
          )}

          {/* Step 1 — Role */}
          {step === 1 && (
            <Q label="What's your superpower?" hint="We match complementary co-founders — opposites build best.">
              <div className="grid grid-cols-2 gap-3">
                {ROLES.map((r) => {
                  const active = role === r.value;
                  return (
                    <button
                      key={r.value}
                      onClick={() => setRole(r.value)}
                      className="flex flex-col items-start gap-2 p-4 rounded-xl border text-left"
                      style={{
                        borderColor: active ? "var(--accent)" : "var(--border)",
                        backgroundColor: active ? "var(--accent-glow)" : "var(--surface)",
                        color: active ? "var(--accent)" : "var(--text-primary)",
                      }}
                    >
                      {r.icon}
                      <span className="font-semibold text-sm">{r.label}</span>
                      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{r.sub}</span>
                    </button>
                  );
                })}
              </div>
            </Q>
          )}

          {/* Step 2 — Building */}
          {step === 2 && (
            <Q label="What are you building (or want to build)?" hint="One line is plenty — your brain card fills in the rest.">
              <textarea
                autoFocus
                value={building}
                onChange={(e) => setBuilding(e.target.value)}
                rows={3}
                placeholder="An AI tool that turns founder notes into co-founder matches…"
                className="w-full px-4 py-3 rounded-xl text-base outline-none border resize-none"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </Q>
          )}

          {/* Step 3 — Need */}
          {step === 3 && (
            <Q label="What do you need in a co-founder?" hint="The gap you most want filled.">
              <textarea
                autoFocus
                value={need}
                onChange={(e) => setNeed(e.target.value)}
                rows={3}
                placeholder="Someone who can own GTM and sales while I build…"
                className="w-full px-4 py-3 rounded-xl text-base outline-none border resize-none"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
              />
            </Q>
          )}

          {/* Step 4 — City */}
          {step === 4 && (
            <Q label="Where are you based?" hint="Powers the “nearest founders” sort. City + region is enough.">
              <div className="relative">
                <MapPin size={16} className="absolute left-4 top-1/2 -translate-y-1/2" style={{ color: "var(--text-secondary)" }} />
                <input
                  autoFocus
                  value={city}
                  onChange={(e) => setCity(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && next()}
                  placeholder="State College, PA"
                  className="w-full pl-11 pr-4 py-3 rounded-xl text-lg outline-none border"
                  style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </div>
            </Q>
          )}

          {/* Step 5 — Instant value teaser */}
          {step === 5 && (
            <TeaserStep name={fullName} role={role || "technical"} building={building} saving={saving} onFinish={() => finish(false)} />
          )}

          {/* Nav buttons (hidden on teaser step — it has its own CTA) */}
          {step < 5 && (
            <div className="flex items-center justify-between mt-8">
              <button
                onClick={back}
                disabled={step === 0}
                className="flex items-center gap-1.5 text-sm disabled:opacity-0"
                style={{ color: "var(--text-secondary)" }}
              >
                <ArrowLeft size={14} /> Back
              </button>
              <button
                onClick={next}
                disabled={!canAdvance}
                className="flex items-center gap-2 px-6 py-2.5 rounded-xl font-semibold text-sm disabled:opacity-40"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                Continue <ArrowRight size={15} />
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function Q({ label, hint, children }: { label: string; hint?: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-col gap-5">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>{label}</h1>
        {hint && <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>{hint}</p>}
      </div>
      {children}
    </div>
  );
}

// The "see the magic first" moment — a sample brain card + a sample match,
// clearly labelled as a preview, with the CTA to generate the real one.
function TeaserStep({
  name, role, building, saving, onFinish,
}: { name: string; role: string; building: string; saving: boolean; onFinish: () => void }) {
  const first = (name || "You").split(" ")[0];
  return (
    <div className="flex flex-col gap-5">
      <div className="text-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium mb-3 border"
          style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "var(--accent-glow)" }}>
          <Sparkles size={12} /> Preview
        </div>
        <h1 className="text-2xl md:text-3xl font-bold" style={{ color: "var(--text-primary)" }}>
          Here&apos;s what BrainScan reads from {first}&apos;s brain
        </h1>
        <p className="text-sm mt-2" style={{ color: "var(--text-secondary)" }}>
          One upload → scans across founder, career &amp; relationships. Here&apos;s a sample founder scan.
        </p>
      </div>

      {/* The three scans */}
      <div className="flex items-center justify-center gap-2 flex-wrap">
        {[
          { label: "Founder", color: "#10b981" },
          { label: "Career", color: "#3b82f6" },
          { label: "Relationships", color: "#ec4899" },
        ].map((d) => (
          <span key={d.label} className="text-xs px-3 py-1 rounded-full border"
            style={{ borderColor: `${d.color}55`, color: d.color, backgroundColor: `${d.color}14` }}>
            {d.label}
          </span>
        ))}
      </div>

      {/* Sample founder scan */}
      <div className="rounded-2xl border overflow-hidden glow-accent"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="p-5 flex items-center gap-3 border-b" style={{ borderColor: "var(--border)" }}>
          <div className="w-11 h-11 rounded-full flex items-center justify-center font-bold"
            style={{ backgroundColor: "var(--accent)", color: "#04110b" }}>
            {(first[0] || "Y").toUpperCase()}
          </div>
          <div className="flex-1">
            <div className="font-semibold" style={{ color: "var(--text-primary)" }}>{name || "Your name"}</div>
            <div className="text-xs capitalize" style={{ color: "var(--text-secondary)" }}>{role} founder · Builder · 7/10</div>
          </div>
          <span className="text-[10px] px-2 py-0.5 rounded-full flex items-center gap-1"
            style={{ backgroundColor: "rgba(245,158,11,0.15)", color: "#f59e0b" }}>
            <ShieldCheck size={10} /> Unverified
          </span>
        </div>
        <div className="p-5 grid grid-cols-2 gap-3 text-xs">
          {[
            ["Who they are", building ? building.slice(0, 60) : "A builder turning ideas into shipped products…"],
            ["How they think", "Systems-first, bias to ship, learns in public…"],
            ["What they value", "Speed, honesty, compounding focus…"],
            ["Needs in a co-founder", "Someone who covers the opposite half…"],
          ].map(([k, v]) => (
            <div key={k} className="p-3 rounded-lg" style={{ backgroundColor: "var(--background)" }}>
              <div className="font-semibold mb-1" style={{ color: "var(--accent)" }}>{k}</div>
              <div style={{ color: "var(--text-secondary)" }}>{v}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Sample match */}
      <div className="rounded-xl border p-4 flex items-center gap-3"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}>
        <div className="w-10 h-10 rounded-full flex items-center justify-center font-bold flex-shrink-0"
          style={{ backgroundColor: "#a78bfa", color: "#0a0e17" }}>MP</div>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
            Maya Patel <span className="text-[11px] font-normal" style={{ color: "var(--text-secondary)" }}>· Stanford · Business</span>
          </div>
          <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Example match — needs a technical co-founder</div>
        </div>
        <div className="text-right">
          <div className="text-lg font-bold" style={{ color: "var(--accent)" }}>88%</div>
          <div className="text-[10px]" style={{ color: "var(--text-secondary)" }}>compatibility</div>
        </div>
      </div>

      <button
        onClick={onFinish}
        disabled={saving}
        className="flex items-center justify-center gap-2 px-6 py-3.5 rounded-xl font-semibold disabled:opacity-50 glow-accent"
        style={{ backgroundColor: "var(--accent)", color: "white" }}
      >
        {saving ? <Loader2 size={16} className="animate-spin" /> : <Check size={16} />}
        Upload my digital brain to generate it
      </button>
      <p className="text-center text-xs" style={{ color: "var(--text-secondary)" }}>
        Obsidian, Notion, or any knowledge base with enough of your thinking.
      </p>
    </div>
  );
}
