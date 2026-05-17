import Link from "next/link";
import { Brain, Zap, Shield, ArrowRight, Upload, Users } from "lucide-react";

export default function Home() {
  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <Link
          href="/upload"
          className="px-4 py-2 rounded-lg text-sm font-medium transition-colors"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Get Started
        </Link>
      </nav>

      {/* Hero */}
      <section className="flex flex-col items-center text-center px-6 pt-24 pb-20">
        <div
          className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-8 border"
          style={{ borderColor: "var(--accent)", color: "var(--accent)", backgroundColor: "var(--accent-glow)" }}
        >
          <Zap size={12} />
          Co-founder matching powered by your thinking
        </div>

        <h1
          className="text-5xl font-bold leading-tight max-w-2xl mb-6"
          style={{ color: "var(--text-primary)" }}
        >
          Find founders who think like{" "}
          <span style={{ color: "var(--accent)" }}>you do</span>
        </h1>

        <p className="text-lg max-w-xl mb-10 leading-relaxed" style={{ color: "var(--text-secondary)" }}>
          Upload your Obsidian vault. We analyze how you think, what you're building, and what you value — then find co-founders whose brains genuinely complement yours.
        </p>

        <div className="flex items-center gap-4">
          <Link
            href="/upload"
            className="flex items-center gap-2 px-6 py-3 rounded-lg font-medium transition-opacity hover:opacity-90"
            style={{ backgroundColor: "var(--accent)", color: "white" }}
          >
            Upload Your Vault
            <ArrowRight size={16} />
          </Link>
          <a
            href="#how-it-works"
            className="px-6 py-3 rounded-lg font-medium transition-colors"
            style={{ color: "var(--text-secondary)", border: "1px solid var(--border)" }}
          >
            How it works
          </a>
        </div>
      </section>

      {/* How it works */}
      <section id="how-it-works" className="px-6 py-20 max-w-4xl mx-auto">
        <h2 className="text-2xl font-bold text-center mb-12" style={{ color: "var(--text-primary)" }}>
          How it works
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
          {[
            {
              icon: <Upload size={22} style={{ color: "var(--accent)" }} />,
              step: "01",
              title: "Upload your vault",
              desc: "Export your Obsidian vault as a zip and upload it. Your notes stay private — we only store the meaning, not the content.",
            },
            {
              icon: <Brain size={22} style={{ color: "var(--accent)" }} />,
              step: "02",
              title: "We build your brain card",
              desc: "AI analyzes how you think, what you're building, your values, and what kind of co-founder would complement you.",
            },
            {
              icon: <Users size={22} style={{ color: "var(--accent)" }} />,
              step: "03",
              title: "Get matched",
              desc: "Describe what you're looking for. We search every brain in our network and return ranked compatibility reports.",
            },
          ].map((item) => (
            <div
              key={item.step}
              className="p-6 rounded-xl border flex flex-col gap-4"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <div className="flex items-center justify-between">
                {item.icon}
                <span className="text-xs font-mono" style={{ color: "var(--text-secondary)" }}>{item.step}</span>
              </div>
              <h3 className="font-semibold" style={{ color: "var(--text-primary)" }}>{item.title}</h3>
              <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{item.desc}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Privacy callout */}
      <section className="px-6 py-16">
        <div
          className="max-w-2xl mx-auto p-8 rounded-2xl border text-center"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Shield size={32} className="mx-auto mb-4" style={{ color: "var(--accent)" }} />
          <h3 className="text-xl font-bold mb-3" style={{ color: "var(--text-primary)" }}>
            Your notes never leave your container
          </h3>
          <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>
            We convert your vault into embeddings — mathematical representations of meaning — stored in your private namespace. Raw text is never shared with other users, accessible to our team, or used for training. When matching runs, only vectors are compared.
          </p>
        </div>
      </section>

      {/* CTA */}
      <section className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold mb-4" style={{ color: "var(--text-primary)" }}>
          Ready to find your co-founder?
        </h2>
        <p className="mb-8 text-sm" style={{ color: "var(--text-secondary)" }}>
          Don't have an Obsidian vault? We'll give you a template to get started.
        </p>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-8 py-4 rounded-lg font-medium transition-opacity hover:opacity-90"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          Get Started — It's Free
          <ArrowRight size={16} />
        </Link>
      </section>

      <footer className="px-8 py-6 border-t text-center text-xs" style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}>
        FindingFounders © 2026
      </footer>
    </div>
  );
}
