"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { FileArchive, RefreshCw, ExternalLink, Info } from "lucide-react";
import { useAuth } from "@/lib/auth-context";

type VaultQuality = {
  score: number;
  stats: { note_count: number; total_words: number; avg_words_per_note: number };
};

export default function VaultPage() {
  const { user } = useAuth();
  const [vaultQuality, setVaultQuality] = useState<VaultQuality | null>(null);

  useEffect(() => {
    if (!user) return;
    const quality = sessionStorage.getItem(`vault_quality_${user.id}`);
    if (quality) setVaultQuality(JSON.parse(quality));
  }, [user]);

  return (
    <div className="flex flex-col gap-8">
      <div>
        <h1 className="text-3xl font-bold mb-1" style={{ color: "var(--text-primary)" }}>
          Vault & Uploads
        </h1>
        <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
          Manage your uploaded Obsidian vault and re-generate your brain card.
        </p>
      </div>

      {/* Current vault stats */}
      {vaultQuality ? (
        <section
          className="p-6 rounded-xl border"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <div className="flex items-start justify-between mb-5">
            <div className="flex items-center gap-3">
              <FileArchive size={20} style={{ color: "var(--accent)" }} />
              <div>
                <h2 className="text-base font-semibold" style={{ color: "var(--text-primary)" }}>
                  Current vault
                </h2>
                <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                  Last analyzed for this session
                </p>
              </div>
            </div>
            <div className="text-right">
              <div className="text-xs" style={{ color: "var(--text-secondary)" }}>Brain confidence</div>
              <div className="text-xl font-bold" style={{ color: "var(--accent)" }}>{vaultQuality.score}%</div>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-4 pt-4 border-t" style={{ borderColor: "var(--border)" }}>
            <Stat label="Notes" value={vaultQuality.stats.note_count.toLocaleString()} />
            <Stat label="Total words" value={vaultQuality.stats.total_words.toLocaleString()} />
            <Stat label="Avg words/note" value={String(vaultQuality.stats.avg_words_per_note)} />
          </div>
        </section>
      ) : (
        <section
          className="p-6 rounded-xl border flex items-center gap-3"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
        >
          <Info size={16} style={{ color: "var(--text-secondary)" }} />
          <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
            No vault data in this session. Upload to get started.
          </p>
        </section>
      )}

      {/* Re-upload CTA */}
      <section
        className="p-6 rounded-xl border flex items-start justify-between gap-6"
        style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
      >
        <div>
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Re-upload your vault
          </h3>
          <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
            Refresh your brain card with your latest notes. Paid tier members get 2 free re-uploads per month; each additional upload is $0.99.
          </p>
        </div>
        <Link
          href="/upload"
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg font-medium text-sm whitespace-nowrap"
          style={{ backgroundColor: "var(--accent)", color: "white" }}
        >
          <RefreshCw size={13} /> Re-upload
        </Link>
      </section>

      {/* No vault? */}
      <section
        className="p-6 rounded-xl border flex items-start gap-4"
        style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
      >
        <ExternalLink size={18} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
        <div className="flex-1">
          <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
            Need to build a vault first?
          </h3>
          <p className="text-xs mb-2" style={{ color: "var(--text-secondary)" }}>
            NextWork has a free guide that walks you through building a personal knowledge base in a weekend with Claude Code.
          </p>
          <a
            href="https://learn.nextwork.org/projects/ai-second-brain-claude-code"
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
            style={{ color: "var(--accent)" }}
          >
            Open the guide <ExternalLink size={10} />
          </a>
        </div>
      </section>

      {/* Upload history (stub) */}
      <section>
        <h3 className="text-sm font-semibold mb-3" style={{ color: "var(--text-primary)" }}>
          Upload history
        </h3>
        <div
          className="p-5 rounded-xl border text-center text-xs"
          style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)", color: "var(--text-secondary)" }}
        >
          Upload history coming soon — once we add a database, you&apos;ll see every analysis here.
        </div>
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex flex-col gap-1">
      <span className="text-xs" style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span className="text-lg font-semibold" style={{ color: "var(--text-primary)" }}>{value}</span>
    </div>
  );
}
