"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Mail, CreditCard, LogOut, Trash2, Lock, ArrowRight, ExternalLink, Loader2, Puzzle, Copy, Check } from "lucide-react";
import { useAuth } from "@/lib/auth-context";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { PrivacyControls } from "@/components/PrivacyControls";

type SubStatus = {
  subscription_tier: "free" | "brain_card" | "full" | string;
  subscription_status: string;
  has_stripe_customer: boolean;
};

const TIER_LABEL: Record<string, { label: string; color: string }> = {
  free: { label: "Free — no brain card yet", color: "#94a3b8" },
  brain_card: { label: "Brain Card — one-time", color: "#a78bfa" },
  full: { label: "Full Membership — active", color: "#10b981" },
};

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();
  const [sub, setSub] = useState<SubStatus | null>(null);
  const [portalBusy, setPortalBusy] = useState(false);
  const [pluginToken, setPluginToken] = useState<string | null>(null);
  const [tokenBusy, setTokenBusy] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!user) return;
    authedFetch(`${API_BASE_URL}/api/payment/status/${user.id}`)
      .then((r) => r.json())
      .then((data: SubStatus) => setSub(data))
      .catch(() => setSub({ subscription_tier: "free", subscription_status: "inactive", has_stripe_customer: false }));
  }, [user]);

  const openBillingPortal = async () => {
    setPortalBusy(true);
    try {
      const res = await authedFetch(`${API_BASE_URL}/api/payment/billing-portal`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { url } = (await res.json()) as { url: string };
      window.location.href = url;
    } catch {
      setPortalBusy(false);
    }
  };

  const connectObsidian = async () => {
    setTokenBusy(true);
    setCopied(false);
    try {
      const res = await authedFetch(`${API_BASE_URL}/api/plugin/token`, { method: "POST" });
      if (!res.ok) throw new Error();
      const { token } = (await res.json()) as { token: string };
      setPluginToken(token);
    } catch {
      setPluginToken(null);
    } finally {
      setTokenBusy(false);
    }
  };

  const copyToken = async () => {
    if (!pluginToken) return;
    try {
      await navigator.clipboard.writeText(pluginToken);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* clipboard unavailable */
    }
  };

  const tierInfo = sub ? TIER_LABEL[sub.subscription_tier] ?? TIER_LABEL.free : null;

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Settings
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Account, subscription, and privacy.
        </p>
      </div>

      {/* Account */}
      <Section title="Account">
        <Row icon={<Mail size={15} />} label="Email" value={user?.email ?? "—"} />
        <Row
          icon={<Lock size={15} />}
          label="Sign-in method"
          value={user?.app_metadata?.provider === "google" ? "Google" : "Email magic link"}
        />
      </Section>

      {/* Subscription */}
      <Section title="Subscription">
        <Row
          icon={<CreditCard size={15} />}
          label="Plan"
          value={
            sub ? (
              <span style={{ color: tierInfo?.color }}>{tierInfo?.label}</span>
            ) : (
              <span style={{ color: "var(--text-secondary)" }}>Loading...</span>
            )
          }
        />
        {sub && (
          <div className="flex flex-wrap gap-3 mt-2">
            {sub.subscription_tier === "free" && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                See plans <ArrowRight size={13} />
              </Link>
            )}
            {sub.subscription_tier === "brain_card" && (
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium"
                style={{ backgroundColor: "var(--accent)", color: "white" }}
              >
                Upgrade to Full Membership <ArrowRight size={13} />
              </Link>
            )}
            {sub.has_stripe_customer && (
              <button
                onClick={openBillingPortal}
                disabled={portalBusy}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium border disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--text-primary)" }}
              >
                {portalBusy ? <Loader2 size={13} className="animate-spin" /> : <ExternalLink size={13} />}
                Manage billing
              </button>
            )}
          </div>
        )}
        <p className="text-xs px-4 py-3 mt-2 rounded-lg" style={{ color: "var(--text-secondary)", backgroundColor: "var(--background)" }}>
          <strong>$0.99</strong> — Brain Card (one-time) ·{" "}
          <strong>$3.99/mo</strong> — Full Membership (2 free re-uploads/month + matching) ·{" "}
          <strong>$0.99</strong> — each extra upload ·{" "}
          <strong>$3.00</strong> — upgrade Brain Card → Full
        </p>
      </Section>

      {/* Connect Obsidian */}
      <Section title="Connect Obsidian">
        <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
          Install the BrainScan plugin in Obsidian, then paste this token into its settings to scan your vault without leaving the app.
        </p>
        {pluginToken ? (
          <div className="flex flex-col gap-2">
            <div
              className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg font-mono text-xs break-all"
              style={{ backgroundColor: "var(--background)", color: "var(--text-primary)" }}
            >
              <span>{pluginToken}</span>
              <button
                onClick={copyToken}
                className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md border text-xs"
                style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
              >
                {copied ? <Check size={12} /> : <Copy size={12} />} {copied ? "Copied" : "Copy"}
              </button>
            </div>
            <p className="text-xs" style={{ color: "#f59e0b" }}>
              Copy it now — it won't be shown again. Generating a new one replaces the old.
            </p>
          </div>
        ) : (
          <div className="flex">
            <button
              onClick={connectObsidian}
              disabled={tokenBusy}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              {tokenBusy ? <Loader2 size={13} className="animate-spin" /> : <Puzzle size={13} />}
              Generate plugin token
            </button>
          </div>
        )}
      </Section>

      {/* Privacy & matching */}
      <Section title="Privacy & matching">
        <PrivacyControls />
        <p className="text-xs px-4 py-3 rounded-lg" style={{ color: "var(--text-secondary)", backgroundColor: "var(--background)" }}>
          Your vault is stored as embeddings (vectors) only — raw text is never persisted past the analysis call. Each user has a private Pinecone namespace; only vectors are compared, never raw notes.
        </p>
      </Section>

      {/* Danger zone */}
      <Section title="Danger zone">
        <button
          onClick={async () => {
            await signOut();
            router.push("/");
          }}
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors border"
          style={{ color: "var(--text-primary)", borderColor: "var(--border)", backgroundColor: "var(--background)" }}
        >
          <span className="flex items-center gap-2"><LogOut size={14} /> Sign out</span>
          <span style={{ color: "var(--text-secondary)" }}>→</span>
        </button>
        <button
          disabled
          className="w-full flex items-center justify-between px-4 py-3 rounded-lg text-sm transition-colors border opacity-50 cursor-not-allowed"
          style={{ color: "#f87171", borderColor: "rgba(248,113,113,0.3)", backgroundColor: "rgba(248,113,113,0.05)" }}
        >
          <span className="flex items-center gap-2"><Trash2 size={14} /> Delete account</span>
          <span className="text-xs" style={{ color: "var(--text-secondary)" }}>coming soon</span>
        </button>
      </Section>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section
      className="p-5 rounded-xl border flex flex-col gap-3"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{title}</h2>
      {children}
    </section>
  );
}

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between px-4 py-3 rounded-lg"
      style={{ backgroundColor: "var(--background)" }}>
      <span className="flex items-center gap-2 text-sm" style={{ color: "var(--text-secondary)" }}>
        {icon} {label}
      </span>
      <span className="text-sm" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
