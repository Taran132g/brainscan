"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Brain, Check, ArrowRight, ArrowLeft, Loader2, Sparkles, Repeat } from "lucide-react";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";

type Product = "brain_card" | "full_membership" | "extra_upload" | "upgrade";

const TIERS: {
  product: Product;
  name: string;
  price: string;
  cadence: string;
  highlight?: boolean;
  features: { text: string; included: boolean }[];
  cta: string;
}[] = [
  {
    product: "brain_card",
    name: "Brain Card",
    price: "$0.99",
    cadence: "one-time",
    features: [
      { text: "Full brain card analysis", included: true },
      { text: "5 founder signals (rank, intelligence, etc.)", included: true },
      { text: "Discover globe — browse other founders", included: true },
      { text: "Matching access", included: false },
      { text: "AI build suggestions", included: false },
      { text: "Monthly upload quota", included: false },
    ],
    cta: "Get your brain card",
  },
  {
    product: "full_membership",
    name: "Full Membership",
    price: "$3.99",
    cadence: "per month",
    highlight: true,
    features: [
      { text: "Everything in Brain Card", included: true },
      { text: "AI-suggested matches", included: true },
      { text: "AI \"what to build together\" briefings", included: true },
      { text: "Hinge-style opt-in messaging", included: true },
      { text: "2 free re-uploads per month", included: true },
      { text: "$0.99 per additional upload", included: true },
    ],
    cta: "Become a member",
  },
];

const EXTRAS: {
  product: Product;
  name: string;
  price: string;
  description: string;
  icon: React.ReactNode;
}[] = [
  {
    product: "extra_upload",
    name: "Extra upload",
    price: "$0.99",
    description: "Re-run the analysis on an updated vault.",
    icon: <Repeat size={16} />,
  },
  {
    product: "upgrade",
    name: "Upgrade to Full",
    price: "$3.00",
    description: "Move from Brain Card to Full Membership. Pays the delta.",
    icon: <Sparkles size={16} />,
  },
];


export default function PricingPage() {
  const router = useRouter();
  const { user, loading } = useAuth();
  const [busyProduct, setBusyProduct] = useState<Product | null>(null);
  const [error, setError] = useState("");

  const startCheckout = async (product: Product) => {
    if (!user) {
      router.push(`/auth?next=/pricing`);
      return;
    }
    setBusyProduct(product);
    setError("");
    try {
      const res = await authedFetch(`${API_BASE_URL}/api/payment/create-checkout`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ product }),
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
      setBusyProduct(null);
    }
  };

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <Link href="/" className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </Link>
        <Link href={user ? "/dashboard" : "/"} className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </nav>

      <div className="max-w-5xl mx-auto px-6 py-16">
        <header className="text-center mb-12">
          <div className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-5 border"
            style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "var(--accent-glow)" }}>
            Honest pricing
          </div>
          <h1 className="text-4xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            These fees cover our costs
          </h1>
          <p className="text-sm max-w-xl mx-auto" style={{ color: "var(--text-secondary)" }}>
            Every brain card runs Claude Opus + Pinecone embeddings. The fees keep the lights on — everything else (matching, discovery, profile) stays free.
          </p>
        </header>

        {/* Main tiers */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mb-12">
          {TIERS.map((tier) => (
            <div
              key={tier.product}
              className="p-7 rounded-2xl border flex flex-col gap-5"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: tier.highlight ? "var(--accent)" : "var(--border)",
                boxShadow: tier.highlight ? "0 0 0 1px var(--accent)" : "none",
              }}
            >
              {tier.highlight && (
                <div className="inline-flex self-start items-center gap-1 px-2.5 py-1 rounded-full text-[10px] font-semibold"
                  style={{ backgroundColor: "var(--accent)", color: "white" }}>
                  RECOMMENDED
                </div>
              )}
              <div>
                <h3 className="text-lg font-bold mb-1" style={{ color: "var(--text-primary)" }}>
                  {tier.name}
                </h3>
                <div className="flex items-baseline gap-1.5">
                  <span className="text-4xl font-bold" style={{ color: "var(--text-primary)" }}>{tier.price}</span>
                  <span className="text-sm" style={{ color: "var(--text-secondary)" }}>{tier.cadence}</span>
                </div>
              </div>

              <ul className="flex flex-col gap-2.5">
                {tier.features.map((f, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    {f.included ? (
                      <Check size={14} style={{ color: "#10b981", marginTop: 3, flexShrink: 0 }} />
                    ) : (
                      <span className="block w-3.5 h-3.5 mt-0.5 flex-shrink-0" style={{ color: "var(--text-secondary)" }}>—</span>
                    )}
                    <span style={{ color: f.included ? "var(--text-primary)" : "var(--text-secondary)" }}>{f.text}</span>
                  </li>
                ))}
              </ul>

              <button
                onClick={() => startCheckout(tier.product)}
                disabled={busyProduct !== null || loading}
                className="w-full flex items-center justify-center gap-2 py-3 rounded-lg font-medium text-sm transition-opacity hover:opacity-90 disabled:opacity-50"
                style={{ backgroundColor: tier.highlight ? "var(--accent)" : "var(--surface-2)", color: tier.highlight ? "white" : "var(--text-primary)", border: tier.highlight ? "none" : "1px solid var(--border)" }}
              >
                {busyProduct === tier.product ? <Loader2 size={14} className="animate-spin" /> : null}
                {tier.cta}
                {busyProduct !== tier.product && <ArrowRight size={14} />}
              </button>
            </div>
          ))}
        </div>

        {/* Extras */}
        <h2 className="text-sm font-semibold mb-3 mt-4" style={{ color: "var(--text-primary)" }}>
          One-time add-ons
        </h2>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mb-10">
          {EXTRAS.map((e) => (
            <div
              key={e.product}
              className="p-5 rounded-xl border flex items-center justify-between gap-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-start gap-3">
                <div className="mt-0.5" style={{ color: "var(--accent)" }}>{e.icon}</div>
                <div>
                  <div className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                    {e.name} <span className="text-xs ml-1" style={{ color: "var(--text-secondary)" }}>· {e.price}</span>
                  </div>
                  <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>{e.description}</p>
                </div>
              </div>
              <button
                onClick={() => startCheckout(e.product)}
                disabled={busyProduct !== null}
                className="flex-shrink-0 px-3 py-1.5 rounded-lg text-xs font-medium border disabled:opacity-50"
                style={{ borderColor: "var(--border)", color: "var(--accent)" }}
              >
                {busyProduct === e.product ? <Loader2 size={12} className="animate-spin" /> : "Buy"}
              </button>
            </div>
          ))}
        </div>

        {error && (
          <p className="text-sm mb-6 px-4 py-3 rounded-lg"
            style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
            {error}
          </p>
        )}

        <p className="text-xs text-center" style={{ color: "var(--text-secondary)" }}>
          Powered by Stripe. Cancel anytime from your dashboard settings.
        </p>
      </div>
    </div>
  );
}
