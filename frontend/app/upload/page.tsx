"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import {
  Brain,
  Upload,
  FileArchive,
  CheckCircle,
  Loader2,
  ArrowLeft,
  ExternalLink,
  Apple,
  Monitor,
  LogOut,
  Github,
  Linkedin,
  AlertCircle,
} from "lucide-react";
import Link from "next/link";
import { API_BASE_URL, authedFetch } from "@/lib/api";
import { useAuth } from "@/lib/auth-context";
import { supabase } from "@/lib/supabase";
import { ScanStats } from "@/components/ScanStats";

type Stage = "idle" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const { user, loading: authLoading, signOut } = useAuth();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");
  const [completedSteps, setCompletedSteps] = useState<string[]>([]);
  const [linkedinUrl, setLinkedinUrl] = useState("");
  const [githubStatus, setGithubStatus] = useState<{
    connected: boolean;
    username?: string;
    quality?: "low" | "medium" | "high";
  } | null>(null);
  const [githubChecking, setGithubChecking] = useState(true);

  // Auth guard
  useEffect(() => {
    if (!authLoading && !user) {
      router.replace("/auth");
    }
  }, [authLoading, user, router]);

  // Pre-fill LinkedIn from saved profile + check GitHub connection
  useEffect(() => {
    if (!user) return;
    const md = (user.user_metadata ?? {}) as { linkedin?: string };
    if (md.linkedin) setLinkedinUrl(md.linkedin);

    authedFetch(`${API_BASE_URL}/api/github/status`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then((data) => setGithubStatus({
        connected: !!data.github_connected,
        username: data.github_username || undefined,
        quality: data.github_quality || undefined,
      }))
      .catch(() => setGithubStatus({ connected: false }))
      .finally(() => setGithubChecking(false));
  }, [user]);

  const steps = [
    { label: "Parsing vault", key: "parsing" },
    { label: "Chunking notes", key: "chunking" },
    { label: "Generating embeddings", key: "embedding" },
    { label: "Storing in private namespace", key: "storing" },
    { label: "Building brain card", key: "brain_card" },
  ];

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file — your digital brain (Obsidian vault, Notion export, or markdown folder), compressed.");
      return;
    }
    setError("");
    setSelectedFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  };

  const handleSubmit = async () => {
    if (!selectedFile || !user) {
      setError("Please select your vault zip first.");
      return;
    }

    const userId = user.id;
    setStage("processing");
    setError("");
    setProgress("Uploading vault...");

    // Persist LinkedIn back to user_metadata so the profile page reflects it.
    // GitHub username comes from the OAuth connection (already in profiles row).
    if (linkedinUrl) {
      await supabase.auth.updateUser({
        data: { ...(user.user_metadata ?? {}), linkedin: linkedinUrl },
      });
    }

    const formData = new FormData();
    formData.append("file", selectedFile);
    if (linkedinUrl) formData.append("linkedin_url", linkedinUrl);

    try {
      const stepDelay = (ms: number) => new Promise((r) => setTimeout(r, ms));
      const progressSteps = async () => {
        await stepDelay(1000);
        setCompletedSteps(["parsing"]);
        setProgress("Chunking notes...");
        await stepDelay(1500);
        setCompletedSteps(["parsing", "chunking"]);
        setProgress("Generating embeddings...");
        await stepDelay(8000);
        setCompletedSteps(["parsing", "chunking", "embedding"]);
        setProgress("Storing in Pinecone...");
        await stepDelay(3000);
        setCompletedSteps(["parsing", "chunking", "embedding", "storing"]);
        setProgress("Building brain card...");
      };

      const [response] = await Promise.all([
        authedFetch(`${API_BASE_URL}/api/upload/${userId}`, {
          method: "POST",
          body: formData,
        }),
        progressSteps(),
      ]);

      if (!response.ok) {
        const data = await response.json();
        const detail = data.detail;

        // 402 paywall — route to pricing instead of showing a wall of text
        if (response.status === 402 && typeof detail === "object" && detail?.code === "payment_required") {
          const product = detail.required_product as string | undefined;
          router.push(`/pricing${product ? `?required=${product}` : ""}`);
          return;
        }

        // 400 github_required — route to profile to connect GitHub
        if (response.status === 400 && typeof detail === "object" && detail?.code === "github_required") {
          router.push("/dashboard/profile?github_required=1");
          return;
        }

        if (typeof detail === "object" && detail?.message) {
          const stats = detail.stats;
          const statsLine = stats
            ? ` (${stats.note_count} notes, ${stats.total_words.toLocaleString()} words, avg ${stats.avg_words_per_note} words/note)`
            : "";
          throw new Error(`${detail.message}${statsLine}`);
        }
        throw new Error(typeof detail === "string" ? detail : "Upload failed");
      }

      const result = await response.json();
      setCompletedSteps(["parsing", "chunking", "embedding", "storing", "brain_card"]);
      setStage("done");

      const displayName =
        (user.user_metadata?.full_name as string | undefined) ??
        user.email ??
        userId;
      sessionStorage.setItem(`braincard_${userId}`, JSON.stringify(result.brain_card));
      sessionStorage.setItem(`user_name_${userId}`, displayName);
      if (result.vault_quality) {
        sessionStorage.setItem(`vault_quality_${userId}`, JSON.stringify(result.vault_quality));
      }

      setTimeout(() => router.push(`/profile/${userId}`), 800);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  // While we figure out auth, show a quick loading state
  if (authLoading || !user) {
    return (
      <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen flex flex-col items-center justify-center gap-3">
        <Brain size={30} className="animate-pulse" style={{ color: "var(--accent)" }} />
        <span className="text-xs" style={{ color: "var(--text-secondary)" }}>Checking your session...</span>
      </div>
    );
  }

  const displayName =
    (user.user_metadata?.full_name as string | undefined) ?? user.email ?? "";

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <div className="flex items-center gap-4">
          <span className="text-xs hidden sm:block" style={{ color: "var(--text-secondary)" }}>
            {displayName}
          </span>
          <button
            onClick={async () => {
              await signOut();
              router.push("/");
            }}
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs border transition-colors"
            style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
          >
            <LogOut size={12} /> Sign out
          </button>
          <Link href="/dashboard" className="flex items-center gap-1 text-sm" style={{ color: "var(--text-secondary)" }}>
            <ArrowLeft size={14} /> Dashboard
          </Link>
        </div>
      </nav>

      <div className="max-w-2xl mx-auto px-6 py-12">
        {stage === "idle" || stage === "error" ? (
          <>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Upload your vault
            </h1>
            <p className="text-sm mb-6" style={{ color: "var(--text-secondary)" }}>
              We&apos;ll process your digital brain — an Obsidian vault, a Notion export, or any
              knowledge base with enough of your thinking — into a brain card so you can find
              co-founders who think like you.
            </p>

            {/* Brain scan counter — at-a-glance */}
            <div className="mb-8">
              <ScanStats compact />
            </div>

            {/* Vault export instructions */}
            <div
              className="p-6 rounded-xl border mb-8"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <h2 className="text-sm font-semibold mb-4" style={{ color: "var(--text-primary)" }}>
                How to export your digital brain as a zip
              </h2>
              <ol className="flex flex-col gap-3">
                <Step n={1}>
                  <strong>Obsidian:</strong> find your vault folder (usually in{" "}
                  <code style={{ color: "var(--accent)" }}>Documents</code> or iCloud).{" "}
                  <strong>Notion:</strong> Settings → Export → <em>Markdown &amp; CSV</em>.{" "}
                  Any folder of markdown notes works.
                </Step>
                <Step n={2}>
                  <span className="flex items-center gap-2">
                    <Apple size={13} style={{ color: "var(--text-secondary)" }} />
                    <span><strong>macOS:</strong> right-click the vault folder → <strong>Compress</strong>.</span>
                  </span>
                  <span className="flex items-center gap-2 mt-1">
                    <Monitor size={13} style={{ color: "var(--text-secondary)" }} />
                    <span><strong>Windows:</strong> right-click → <strong>Send to → Compressed (zipped) folder</strong>.</span>
                  </span>
                </Step>
                <Step n={3}>Drop the resulting <code style={{ color: "var(--accent)" }}>.zip</code> file below.</Step>
              </ol>
              <p className="text-xs mt-4 pt-4 border-t" style={{ color: "var(--text-secondary)", borderColor: "var(--border)" }}>
                Vault size limit: 100MB. Minimum: 200 notes (with avg 300+ words) or 1,000 notes total.
              </p>
            </div>

            {/* GitHub gate (required) */}
            <div
              className="p-6 rounded-xl border mb-6"
              style={{
                backgroundColor: "var(--surface)",
                borderColor: githubStatus?.connected ? "#10b981" : "#f59e0b",
              }}
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div className="flex items-center gap-3">
                  <Github size={18} style={{ color: githubStatus?.connected ? "#10b981" : "#f59e0b" }} />
                  <div>
                    <h2 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>
                      GitHub {githubStatus?.connected ? "connected" : "optional"}
                    </h2>
                    <p className="text-xs mt-0.5" style={{ color: "var(--text-secondary)" }}>
                      {githubChecking
                        ? "Checking..."
                        : githubStatus?.connected
                        ? `Linked as ${githubStatus.username}${githubStatus.quality ? ` · grade: ${githubStatus.quality}` : ""}`
                        : "Optional — but unverified founders show lower brain confidence. Connect GitHub (and LinkedIn) to verify your signal and boost credibility."}
                    </p>
                  </div>
                </div>
                {!githubStatus?.connected && !githubChecking && (
                  <Link
                    href="/dashboard/profile"
                    className="px-4 py-2 rounded-lg text-sm font-medium whitespace-nowrap"
                    style={{ backgroundColor: "var(--accent)", color: "white" }}
                  >
                    Connect GitHub
                  </Link>
                )}
              </div>
            </div>

            {/* LinkedIn (optional) */}
            <div
              className="p-6 rounded-xl border mb-6"
              style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
            >
              <label className="flex flex-col gap-1.5">
                <span className="text-xs font-medium flex items-center gap-2" style={{ color: "var(--text-primary)" }}>
                  <Linkedin size={12} /> LinkedIn URL <span style={{ color: "var(--text-secondary)" }}>(optional)</span>
                </span>
                <input
                  type="url"
                  value={linkedinUrl}
                  onChange={(e) => setLinkedinUrl(e.target.value.trim())}
                  placeholder="https://linkedin.com/in/your-handle"
                  className="px-3 py-2 rounded-lg text-sm outline-none border"
                  style={{ backgroundColor: "var(--background)", borderColor: "var(--border)", color: "var(--text-primary)" }}
                />
              </label>
            </div>

            {/* Drop zone */}
            <div
              onClick={() => fileInputRef.current?.click()}
              onDrop={handleDrop}
              onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
              onDragLeave={() => setDragOver(false)}
              className="relative flex flex-col items-center justify-center gap-3 p-10 rounded-xl border-2 border-dashed cursor-pointer transition-colors mb-4"
              style={{
                borderColor: dragOver ? "var(--accent)" : selectedFile ? "var(--accent)" : "var(--border)",
                backgroundColor: dragOver ? "var(--accent-glow)" : "var(--surface)",
              }}
            >
              <input
                ref={fileInputRef}
                type="file"
                accept=".zip"
                className="hidden"
                onChange={(e) => e.target.files?.[0] && handleFile(e.target.files[0])}
              />
              {selectedFile ? (
                <>
                  <FileArchive size={28} style={{ color: "var(--accent)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>{selectedFile.name}</p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>
                    {(selectedFile.size / 1024 / 1024).toFixed(1)} MB — click to change
                  </p>
                </>
              ) : (
                <>
                  <Upload size={28} style={{ color: "var(--text-secondary)" }} />
                  <p className="text-sm font-medium" style={{ color: "var(--text-primary)" }}>
                    Drop your vault zip here
                  </p>
                  <p className="text-xs" style={{ color: "var(--text-secondary)" }}>or click to browse</p>
                </>
              )}
            </div>

            {error && (
              <p className="text-sm mb-4 px-4 py-3 rounded-lg"
                style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!selectedFile || !githubStatus?.connected || githubChecking}
              className="w-full py-3 rounded-lg font-medium text-sm transition-opacity disabled:opacity-40 disabled:cursor-not-allowed"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              Analyze My Brain
            </button>

            {/* No vault? NextWork CTA */}
            <div
              className="mt-10 p-6 rounded-xl border flex items-start gap-4"
              style={{ backgroundColor: "var(--surface-2)", borderColor: "var(--border)" }}
            >
              <Brain size={22} style={{ color: "var(--accent)", flexShrink: 0, marginTop: 2 }} />
              <div className="flex-1">
                <h3 className="text-sm font-semibold mb-1" style={{ color: "var(--text-primary)" }}>
                  Don&apos;t have an Obsidian vault yet?
                </h3>
                <p className="text-xs mb-3" style={{ color: "var(--text-secondary)" }}>
                  Build your digital brain in a weekend with this free guide from NextWork — it walks you through setting up
                  a personal knowledge base with Claude Code.
                </p>
                <a
                  href="https://learn.nextwork.org/projects/ai-second-brain-claude-code"
                  target="_blank"
                  rel="noreferrer"
                  className="inline-flex items-center gap-1 text-xs font-medium hover:underline"
                  style={{ color: "var(--accent)" }}
                >
                  Open the guide
                  <ExternalLink size={11} />
                </a>
              </div>
            </div>

            <p className="text-xs text-center mt-8" style={{ color: "var(--text-secondary)" }}>
              These fees cover Claude API + Pinecone + hosting costs. Everything beyond the upload is free.
            </p>
          </>
        ) : (
          <div className="flex flex-col items-center text-center gap-8 pt-8">
            {stage === "done" ? (
              <CheckCircle size={52} style={{ color: "#34d399" }} />
            ) : (
              <div
                className="w-14 h-14 rounded-full flex items-center justify-center"
                style={{ backgroundColor: "var(--accent-glow)", border: "1px solid var(--accent)" }}
              >
                <Loader2 size={26} className="animate-spin" style={{ color: "var(--accent)" }} />
              </div>
            )}

            <div>
              <h2 className="text-2xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
                {stage === "done" ? "Brain card ready!" : "Processing your vault"}
              </h2>
              <p className="text-sm" style={{ color: "var(--text-secondary)" }}>
                {stage === "done" ? "Redirecting to your profile..." : progress}
              </p>
            </div>

            <div className="w-full flex flex-col gap-3">
              {steps.map((step) => {
                const done = completedSteps.includes(step.key);
                const active = !done && progress.toLowerCase().includes(step.label.split(" ")[0].toLowerCase());
                return (
                  <div
                    key={step.key}
                    className="flex items-center gap-3 px-4 py-3 rounded-lg"
                    style={{ backgroundColor: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    {done ? (
                      <CheckCircle size={16} style={{ color: "#34d399" }} />
                    ) : active ? (
                      <Loader2 size={16} className="animate-spin" style={{ color: "var(--accent)" }} />
                    ) : (
                      <div className="w-4 h-4 rounded-full border" style={{ borderColor: "var(--border)" }} />
                    )}
                    <span className="text-sm" style={{ color: done ? "var(--text-primary)" : "var(--text-secondary)" }}>
                      {step.label}
                    </span>
                  </div>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function Step({ n, children }: { n: number; children: React.ReactNode }) {
  return (
    <li className="flex items-start gap-3 text-sm" style={{ color: "var(--text-primary)" }}>
      <span
        className="flex items-center justify-center w-6 h-6 rounded-full text-xs font-semibold flex-shrink-0"
        style={{ backgroundColor: "var(--accent-glow)", color: "var(--accent)", border: "1px solid var(--accent)" }}
      >
        {n}
      </span>
      <div className="flex flex-col" style={{ color: "var(--text-secondary)" }}>{children}</div>
    </li>
  );
}
