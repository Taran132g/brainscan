import { Brain, Zap, Shield, ArrowRight, Users, Download, Sparkles, Briefcase, Heart } from "lucide-react";
import { SmartCta } from "@/components/SmartCta";
import { BrainGridBackground } from "@/components/BrainGridBackground";
import { ScanCard } from "@/components/ScanCard";
import { BrainCardHero } from "@/components/BrainCardHero";
import { Reveal } from "@/components/Reveal";
import { VideoWall } from "@/components/VideoWall";

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
          <span className="font-semibold text-lg font-display" style={{ color: "var(--text-primary)" }}>BrainScan</span>
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
          AI that reads your second brain
        </div>

        <h1
          className="text-5xl md:text-7xl font-bold leading-[1.04] max-w-3xl mb-6 animate-in animate-in-1"
          style={{ color: "var(--text-primary)" }}
        >
          See how you actually think{" "}
          <span
            style={{
              background: "linear-gradient(120deg, var(--accent), var(--accent-hover) 60%, #a78bfa)",
              WebkitBackgroundClip: "text",
              backgroundClip: "text",
              color: "transparent",
            }}
          >
            — read from your own notes
          </span>
        </h1>

        <p className="text-lg md:text-xl max-w-xl mb-10 leading-relaxed animate-in animate-in-2" style={{ color: "var(--text-secondary)" }}>
          Upload your digital brain — Obsidian, Notion, any knowledge base. BrainScan reads how you think,
          your <strong style={{ color: "var(--text-primary)" }}>career</strong>, and your <strong style={{ color: "var(--text-primary)" }}>relationships</strong> into
          one Brain Card — then connects you with the people you&apos;d genuinely click with.
        </p>

        <div className="flex flex-wrap items-center justify-center gap-4 mb-16 animate-in animate-in-3">
          <SmartCta
            className="flex items-center gap-2 px-7 py-3.5 rounded-xl font-semibold hover:opacity-90 glow-accent"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Scan your brain
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

      {/* What the one Brain Card reads */}
      <section className="px-6 pb-8 pt-4 max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            One scan. The whole you.
          </h2>
          <p className="text-sm text-center mb-10 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
            A single Brain Card reads across everything that makes you <em>you</em> — then matches you with
            people who genuinely fit.
          </p>
        </Reveal>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
          {[
            {
              icon: <Brain size={22} />,
              color: "#10b981",
              title: "How you think",
              desc: "Your mental models, curiosity, and the patterns that run under everything you do.",
            },
            {
              icon: <Briefcase size={22} />,
              color: "#3b82f6",
              title: "Career & ambition",
              desc: "How you actually work and where you're headed — execution style, strengths, what drives you.",
            },
            {
              icon: <Heart size={22} />,
              color: "#ec4899",
              title: "How you connect",
              desc: "How you relate, communicate, and what you need from the people around you.",
            },
          ].map((d, i) => (
            <Reveal key={d.title} delay={i * 90} className="h-full">
              <div
                className="p-6 rounded-2xl border h-full card-hover flex flex-col gap-3"
                style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
              >
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: `${d.color}1f`, color: d.color }}
                >
                  {d.icon}
                </div>
                <h3 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>{d.title}</h3>
                <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{d.desc}</p>
              </div>
            </Reveal>
          ))}
        </div>
      </section>

      {/* Video wall — short-form clips, rendered vertical like the PAIS content dashboard */}
      <section className="px-6 py-20 max-w-5xl mx-auto">
        <Reveal>
          <h2 className="text-2xl md:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            See BrainScan in action
          </h2>
          <p className="text-sm text-center mb-12 max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
            A few seconds on what it&apos;s like to turn your digital brain into a Brain Card — and meet the
            people behind the other cards.
          </p>
        </Reveal>
        <VideoWall />
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 max-w-6xl mx-auto">
        <Reveal>
          <h2 className="text-3xl md:text-4xl font-bold text-center mb-3" style={{ color: "var(--text-primary)" }}>
            From digital brain to insight
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
              title: "Get your Brain Card",
              desc: "AI reads your whole self into one card — how you think, your career, and how you connect.",
            },
            {
              icon: <Users size={22} style={{ color: "var(--accent)" }} />,
              step: "04",
              title: "Meet your people",
              desc: "Get matched on how you actually think — similar minds, or ones that complement your gaps.",
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

      {/* Example Brain Card */}
      <section className="px-6 pb-20 max-w-2xl mx-auto">
        <Reveal>
          <div className="text-center mb-8">
            <div className="inline-flex items-center gap-2 text-xs font-medium mb-3" style={{ color: "var(--accent)" }}>
              <Sparkles size={14} />
              EXAMPLE BRAIN CARD
            </div>
            <h2 className="text-2xl md:text-4xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              This is what we generate
            </h2>
            <p className="text-sm max-w-lg mx-auto" style={{ color: "var(--text-secondary)" }}>
              Six sections + a signal read, inferred from how you actually write — not a form you fill out.
              It&apos;s what we use to find your people.
            </p>
          </div>
        </Reveal>
        <Reveal>
          <BrainCardHero
            name="Alex Rivera"
            signal={{ openness: "high", drive: "high", communication_style: "direct", social_energy: "ambivert", emotional_openness: "medium", connection_style: "secure", conflict_style: "collaborative", core_motivation: "mastery" }}
            brainConfidence={86}
            avatarUrl={null}
            profile={{ city: "San Francisco", school: "Stanford", github: "alexr", linkedin: "alexrivera", instagram: "alex.rivera" }}
          />
        </Reveal>
        <Reveal className="block mt-6">
          <ScanCard
            domain="brainscan"
            sections={{
              "Who They Are": "A builder and obsessive note-taker who thinks on the page. Their vault is years of half-finished ideas, book margins, and 2am voice memos — the raw material of someone learning in public and in private at once.",
              "How They Think": "First-principles and fast. They prototype ideas to understand them, reason from evidence over consensus, and circle back to the same handful of questions across notebooks — a sign of where their real curiosity lives.",
              "Career & Ambition": "Drawn to ambitious, early-stage work where taste and execution both matter. Their notes track a quiet through-line: build things people actually use, and get closer to work that feels like their own.",
              "How They Connect": "Loyal and direct; bonds over ideas and shared obsessions, not small talk. The writing keeps returning to a few people — proof they invest in depth over breadth, and notice when relationships go quiet.",
              "Values & What Drives Them": "Honesty, momentum, and craft. Motivated by making something real, by people who push back, and by the discomfort of not yet being good enough at the thing they care about most.",
              "What They're Looking For": "People who trade ideas at 2am, builders mid-leap, and friends who show up. Open to minds like theirs — and to the ones who fill the gaps they keep writing around.",
            }}
            signal={{ openness: "high", drive: "high", communication_style: "direct", social_energy: "ambivert", emotional_openness: "medium", connection_style: "secure", conflict_style: "collaborative", core_motivation: "mastery" }}
          />
        </Reveal>
        <p className="text-center text-xs mt-4" style={{ color: "var(--text-muted)" }}>
          A sample — your real card and your people appear once you upload your digital brain.
        </p>
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
            Ready to scan your brain?
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
        BrainScan © 2026
      </footer>
    </div>
  );
}
