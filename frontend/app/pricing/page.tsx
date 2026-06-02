"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Check, ArrowRight, ArrowLeft, Loader2, Github } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

const REPO_URL = "https://github.com/Taran132g/FindingFounders";

export default function PricingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const buyScan = async () => {
    if (!user) {
      router.push(`/auth?next=/pricing`);
      return;
    }
    setBusy(true);
    setError("");
    try {
      const res = await authedFetch(`${API_BASE_URL}/api/payment/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product: "brain_card" }),
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(typeof data.detail === "string" ? data.detail : "Checkout failed");
      }
      const { url } = (await res.json()) as { url: string };
      if (!url) throw new Error("No checkout URL returned");
      window.location.href = url;
    } catch (e) {
      setError(e instanceof Error ? e.message : "Something went wrong starting checkout.");
      setBusy(false);
    }
  };

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>BrainScan</span>
        </Link>
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </nav>

      <div className="max-w-3xl mx-auto px-6 py-16">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5 border"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "var(--accent-glow)" }}>
            Simple pricing
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Two ways to get your Brain Card
          </h1>
          <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Let us run it for $2, or run the open-source scan yourself for free and store the result here.
            Either way the card is yours to keep, share, and re-run.
          </p>
        </header>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Paid — hosted scan */}
          <div
            className="p-7 rounded-2xl border flex flex-col gap-5"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--accent)", boxShadow: "0 0 0 1px var(--accent)" }}
          >
            <div className="inline-flex self-start items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: "var(--accent)", color: "white" }}>
              EASIEST
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>Full Brain Scan</h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>$2</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>one-time</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5">
              {[
                "We run the whole comprehensive scan for you",
                "Whole-person card — 6 sections + 8-signal read",
                "Public shareable profile link",
                "Privacy controls — go private or hide sections",
                "Re-run anytime your notes change",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check size={14} style={{ color: "#10b981", marginTop: 3, flexShrink: 0 }} />
                  <span style={{ color: "var(--text-primary)" }}>{t}</span>
                </li>
              ))}
            </ul>
            <button
              onClick={buyScan}
              disabled={busy || loading}
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              {busy ? <Loader2 size={14} className="animate-spin" /> : null}
              Get your brain scan
              {!busy && <ArrowRight size={14} />}
            </button>
          </div>

          {/* Free — self-host */}
          <div
            className="p-7 rounded-2xl border flex flex-col gap-5"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <div className="inline-flex self-start items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-secondary)", border: "1px solid var(--border)" }}>
              FOR TINKERERS
            </div>
            <div>
              <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>Run it yourself</h3>
              <div className="flex items-baseline gap-1.5">
                <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>Free</span>
                <span className="text-sm" style={{ color: "var(--text-secondary)" }}>your own API keys</span>
              </div>
            </div>
            <ul className="flex flex-col gap-2.5">
              {[
                "Clone the open-source repo",
                "Run scan_local.py with your Anthropic + Pinecone keys",
                "Your notes never leave your machine",
                "Import the result here to store + view it free",
                "Same card, same privacy controls",
              ].map((t, i) => (
                <li key={i} className="flex items-start gap-2 text-sm">
                  <Check size={14} style={{ color: "var(--text-secondary)", marginTop: 3, flexShrink: 0 }} />
                  <span style={{ color: "var(--text-primary)" }}>{t}</span>
                </li>
              ))}
            </ul>
            <a
              href={REPO_URL}
              target="_blank"
              rel="noreferrer"
              className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90"
              style={{ backgroundColor: "var(--surface-2)", color: "var(--text-primary)", border: "1px solid var(--border)" }}
            >
              <Github size={15} /> Get the repo
            </a>
          </div>
        </div>

        {error && (
          <p className="text-sm mt-6 px-4 py-3 rounded-lg"
            style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
            {error}
          </p>
        )}

        <p className="text-xs text-center mt-10" style={{ color: "var(--text-secondary)" }}>
          Paid scans are powered by Stripe. The $2 covers the Claude + Pinecone cost of running your scan.
          Already ran it yourself? Import your card on the{" "}
          <Link href="/dashboard/brain-card" className="hover:underline" style={{ color: "var(--accent)" }}>Brain Card page</Link>.
        </p>
      </div>
    </div>
  );
}
