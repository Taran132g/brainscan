"use client";

import { useRouter } from "next/navigation";
import { Mail, CreditCard, LogOut, Trash2, Lock } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

export default function SettingsPage() {
  const router = useRouter();
  const { user, signOut } = useAuth();

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

      {/* Account info */}
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
          value="Free — brain card generated"
        />
        <p className="text-xs px-4 py-3 mt-2 rounded-lg" style={{ color: "var(--text-secondary)", backgroundColor: "var(--background)" }}>
          Stripe integration coming soon. Pricing tiers:
          <br />
          • <strong>$0.99</strong> — brain card only (one-time)
          <br />
          • <strong>$3.99/mo</strong> — full membership with matching + 2 free re-uploads/month
          <br />
          • <strong>$3.00 upgrade</strong> — brain card → full membership
          <br />
          • <strong>$0.99</strong> — each additional upload beyond included
        </p>
      </Section>

      {/* Privacy */}
      <Section title="Privacy">
        <p className="text-xs px-4 py-3 rounded-lg" style={{ color: "var(--text-secondary)", backgroundColor: "var(--background)" }}>
          Your vault is stored as embeddings (vectors) only — raw text is never persisted past the analysis call. Each user has a private Pinecone namespace. When matching launches, only vectors are compared, never raw notes.
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

function Row({ icon, label, value }: { icon: React.ReactNode; label: string; value: string }) {
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
