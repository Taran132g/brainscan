import { Brain, Zap, Shield, ArrowRight, Users, Award, Download, Sparkles } from "lucide-react";
import { SmartCta } from "@/components/SmartCta";
import { BrainGridBackground } from "@/components/BrainGridBackground";
import { BrainCardHero } from "@/components/BrainCardHero";
import { Reveal } from "@/components/Reveal";
import { TIER_INFO } from "@/lib/fake-users";

const TIER_ORDER = ["Visionary", "Builder", "Operator", "Explorer", "Newcomer"] as const;

export default function Home() {
  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      {/* Nav */}
      <nav
        className="sticky top-0 z-50 flex items-center justify-between px-8 py-4 border-b backdrop-blur-xl"
        style={{ borderColor: "var(--border)", backgroundColor: "rgba(6,8,16,0.72)" }}
      >
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg font-display" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <SmartCta
          className="px-4 py-2 rounded-lg text-sm font-semibold hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Get Started
        </SmartCta>
      </nav>

      {/* Hero — digital-brain node grid backdrop */}
      <div className="relative overflow-hidden">
        <div className="absolute inset-0 bg-grid" aria-hidden />
        <BrainGridBackground />
        <section className="relative z-10 flex flex-col items-center text-center px-6 pt-24 pb-16 max-w-5xl mx-auto">
        <div
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full text-xs font-medium mb-8 border animate-in"
          style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "var(--accent-glow)" }}
        >
          <Zap size={12} />
          Co-founder matching powered by how you think
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold leading-[1.04] max-w-3xl mb-6 animate-in animate-in-1"
          style={{ color: "var(--text-primary)" }}
        >
          Find founders who think{" "}
          <span
            style={{
              background: "linear-gradient(120deg, var(--accent), var(--accent-hover) 60%, #a78bfa)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            like you do
          </span>
        </h1>

        <p className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed animate-in animate-in-2" style={{ color: "var(--text-secondary)" }}>
          Upload your digital brain — Obsidian, Notion, or any knowledge base. We analyze how you think,
          what you&apos;re building, and what you value — then match you with co-founders whose brains genuinely complement yours.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-16 animate-in animate-in-3">
          <SmartCta
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold hover:opacity-90 glow-accent"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Upload Your Vault
            <ArrowRight size={16} />
          </SmartCta>
          <a
            href="#how-it-works"
            className="px-6 py-3.5 rounded-xl font-medium hover:border-[color:var(--accent)]"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            How it works
          </a>
        </div>
        </section>
      </div>

      {/* Mission */}
      <section className="px-6 py-20 max-w-3xl mx-auto text-center">
        <Reveal>
          <div className="text-xs font-medium mb-4 tracking-wider" style={{ color: "var(--accent)" }}>
            WHY WE EXIST
          </div>
          <h2 className="text-2xl md:text-4xl font-bold mb-6 leading-snug" style={{ color: "var(--text-primary)" }}>
            Startups rarely die from bad ideas. They die from the wrong co-founder.
          </h2>
          <p className="text-base md:text-lg leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            A résumé and a &ldquo;looking for a technical co-founder&rdquo; post can&apos;t tell you how
            someone actually thinks, what they value, or whether you&apos;ll still want to build together
            at 2am on month nine. We believe the truest signal of fit is already written down — in your
            notes, your ideas, your <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>digital brain</span>.
            FindingFounders turns that into a founder profile and matches you on substance, not surface.
          </p>
        </Reveal>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            From digital brain to co-founder
          </h2>
          <p className="text-sm text-center mb-12 max-w-md mx-auto" style={{ color: "var(--text-secondary)" }}>
            Four steps. The hardest part — building a second brain — you may already have done.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {[
            {
              icon: <Brain size={22} style={{ color: "var(--accent)" }} />,
              step: "01",
              title: "Build your digital brain",
              desc: "An Obsidian vault, a Notion workspace — anywhere you already dump your thinking. New to this?",
              link: { href: "https://learn.nextwork.org/projects/ai-second-brain-claude-code", label: "Set one up in an afternoon" },
            },
            {
              icon: <Download size={22} style={{ color: "var(--accent)" }} />,
              step: "02",
              title: "Download it as a zip",
              desc: "Obsidian: compress your vault folder. Notion: Settings → Export → Markdown & CSV. Then drop the zip in.",
            },
            {
              icon: <Sparkles size={22} style={{ color: "var(--accent)" }} />,
              step: "03",
              title: "Get your brain card",
              desc: "AI reads how you think, what you're building, and what you value — and ranks you 1–10 as a founder.",
            },
            {
              icon: <Users size={22} style={{ color: "var(--accent)" }} />,
              step: "04",
              title: "Match on substance",
              desc: "Connect with founders who complement your strengths and gaps. You both opt in, then messaging unlocks.",
            },
          ].map((item, i) => (
            <Reveal key={item.step} delay={i * 80}>
              <div
                className="p-6 rounded-xl border flex flex-col gap-3 h-full card-hover"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div className="flex items-center justify-between">
                  {item.icon}
                  <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{item.step}</span>
                </div>
                <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
                {item.link && (
                  <a
                    href={item.link.href}
                    target="_blank"
                    rel="noreferrer"
                    className="text-sm font-medium inline-flex items-center gap-1 mt-auto hover:underline"
                    style={{ color: "var(--accent)" }}
                  >
                    {item.link.label} <ArrowRight size={13} />
                  </a>
                )}
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Example brain cards */}
      <section className="px-6 pb-20 max-w-4xl mx-auto">
        <Reveal>
          <div className="text-center mb-10">
            <div className="inline-flex items-center gap-2 text-xs font-medium mb-3" style={{ color: "var(--accent)" }}>
              <Sparkles size={14} />
              EXAMPLE BRAIN CARDS
            </div>
            <h2 className="text-2xl md:text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              This is what we generate
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
              Five sections, a founder signal, and a 1–10 rank — inferred from how you actually write, not a
              form you fill out. Connecting GitHub &amp; LinkedIn verifies you and raises your brain confidence.
            </p>
          </div>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <Reveal>
            <BrainCardHero
              variant="compact"
              name="Maya Patel"
              brainConfidence={88}
              founderSignal={{ domain_obsession: "high", emotional_stability_signal: "high", shipped_before: true, market_orientation: "b2b", implied_intelligence: "high" }}
              profile={{ school: "Stanford University", github: "mayap", linkedin: "https://linkedin.com/in/maya" }}
            />
          </Reveal>
          <Reveal delay={90}>
            <BrainCardHero
              variant="compact"
              name="Priya Krishnan"
              brainConfidence={71}
              founderSignal={{ domain_obsession: "high", emotional_stability_signal: "medium", shipped_before: true, market_orientation: "infrastructure", implied_intelligence: "high" }}
              profile={{ school: "UC Berkeley" }}
            />
          </Reveal>
        </div>
        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          Example founders — your real card and matches appear once you upload your digital brain.
        </p>
      </section>

      {/* Tier system */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <Reveal>
          <div className="text-center mb-12">
            <div className="inline-flex items-center gap-2 text-xs font-medium mb-3" style={{ color: "var(--accent)" }}>
              <Award size={14} />
              FOUNDER TIERS
            </div>
            <h2 className="text-2xl md:text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Ranked 1–10. Five tiers.
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
              Your rank is computed from your brain card, your shipped track record, and verifiable signals
              from GitHub and LinkedIn. Higher rank = better match quality.
            </p>
          </div>
        </Reveal>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {TIER_ORDER.map((tier, i) => {
            const info = TIER_INFO[tier];
            return (
              <Reveal key={tier} delay={i * 70} className="h-full">
              <div
                className="p-5 rounded-xl border flex flex-col gap-3 h-full card-hover"
                style={{ backgroundColor: "var(--surface)", borderColor: info.color }}
              >
                <div className="flex items-center justify-between">
                  <div
                    className="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold"
                    style={{ backgroundColor: info.color, color: "#0a0e17" }}
                  >
                    {info.minRank === 9 ? "10" : info.minRank === 7 ? "8" : info.minRank === 5 ? "6" : info.minRank === 3 ? "4" : "2"}
                  </div>
                  <span className="text-[10px] font-mono" style={{ color: "var(--text-secondary)" }}>
                    {info.minRank}–{info.minRank === 9 ? 10 : info.minRank + 1}
                  </span>
                </div>
                <h3 className="font-bold" style={{ color: info.color }}>{tier}</h3>
                <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{info.description}</p>
              </div>
              </Reveal>
            );
          })}
        </div>
      </section>

      {/* Privacy callout */}
      <section className="px-6 py-16">
        <Reveal>
          <div
            className="max-w-2xl mx-auto p-8 rounded-2xl border text-center card-hover"
            style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
          >
            <Shield size={32} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
            <h3 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
              Your notes never leave your container
            </h3>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
              We convert your digital brain into embeddings — mathematical representations of meaning — stored in your private namespace.
              Raw text is never shared with other users, accessible to our team, or used for training. Only vectors are compared.
            </p>
          </div>
        </Reveal>
      </section>

      {/* CTA */}
      <section className="px-6 py-24 text-center">
        <Reveal>
          <h2 className="text-3xl md:text-5xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
            Ready to find your co-founder?
          </h2>
          <p className="mb-8 text-sm" style={{ color: "var(--text-secondary)" }}>
            Don&apos;t have a digital brain yet?{" "}
            <a
              href="https://learn.nextwork.org/projects/ai-second-brain-claude-code"
              target="_blank"
              rel="noreferrer"
              style={{ color: "var(--accent)" }}
              className="hover:underline"
            >
              Build your digital brain →
            </a>
          </p>
          <SmartCta
            className="inline-flex items-center gap-2 px-8 py-4 rounded-xl font-semibold hover:opacity-90 glow-accent"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Get Started
            <ArrowRight size={16} />
          </SmartCta>
        </Reveal>
      </section>

      <footer className="px-8 py-6 border-t text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        FindingFounders © 2026
      </footer>
    </div>
  );
}
