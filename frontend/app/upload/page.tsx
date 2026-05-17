"use client";

import { useState, useRef } from "react";
import { useRouter } from "next/navigation";
import { Brain, Upload, FileArchive, CheckCircle, Loader2, ArrowLeft } from "lucide-react";
import Link from "next/link";
import { API_BASE_URL } from "@/lib/api";

type Stage = "idle" | "uploading" | "processing" | "done" | "error";

export default function UploadPage() {
  const router = useRouter();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [stage, setStage] = useState<Stage>("idle");
  const [dragOver, setDragOver] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [error, setError] = useState("");
  const [progress, setProgress] = useState("");

  const steps = [
    { label: "Parsing vault", key: "parsing" },
    { label: "Chunking notes", key: "chunking" },
    { label: "Generating embeddings", key: "embedding" },
    { label: "Storing in private namespace", key: "storing" },
    { label: "Building brain card", key: "brain_card" },
  ];

  const [completedSteps, setCompletedSteps] = useState<string[]>([]);

  const handleFile = (file: File) => {
    if (!file.name.endsWith(".zip")) {
      setError("Please upload a .zip file (Obsidian vault export).");
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
    if (!selectedFile || !name || !email) {
      setError("Please fill in your name, email, and upload your vault.");
      return;
    }

    const userId = email.replace(/[^a-z0-9]/gi, "_").toLowerCase();
    setStage("uploading");
    setError("");

    const formData = new FormData();
    formData.append("file", selectedFile);

    try {
      setStage("processing");
      setProgress("Uploading vault...");

      // Simulate step progress while the real request runs
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
        fetch(`${API_BASE_URL}/api/upload/${userId}`, {
          method: "POST",
          body: formData,
        }),
        progressSteps(),
      ]);

      if (!response.ok) {
        const data = await response.json();
        // FastAPI structured errors come back as data.detail (object or string)
        const detail = data.detail;
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

      // Store brain card + quality in sessionStorage to pass to profile page
      sessionStorage.setItem(`braincard_${userId}`, JSON.stringify(result.brain_card));
      sessionStorage.setItem(`user_name_${userId}`, name);
      if (result.vault_quality) {
        sessionStorage.setItem(`vault_quality_${userId}`, JSON.stringify(result.vault_quality));
      }

      setTimeout(() => router.push(`/profile/${userId}`), 800);
    } catch (err) {
      setStage("error");
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  };

  return (
    <div style={{ backgroundColor: "var(--background)" }} className="min-h-screen">
      {/* Nav */}
      <nav className="flex items-center justify-between px-8 py-5 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <Brain size={22} style={{ color: "var(--accent)" }} />
          <span className="font-semibold text-lg" style={{ color: "var(--text-primary)" }}>FindingFounders</span>
        </div>
        <Link href="/" className="flex items-center gap-1 text-sm transition-colors" style={{ color: "var(--text-secondary)" }}>
          <ArrowLeft size={14} /> Back
        </Link>
      </nav>

      <div className="max-w-xl mx-auto px-6 py-16">
        {stage === "idle" || stage === "error" ? (
          <>
            <h1 className="text-3xl font-bold mb-2" style={{ color: "var(--text-primary)" }}>
              Upload your vault
            </h1>
            <p className="text-sm mb-8" style={{ color: "var(--text-secondary)" }}>
              Export your Obsidian vault via <strong>File → Export as zip</strong>, then upload it below.
            </p>

            {/* Name + Email */}
            <div className="flex flex-col gap-4 mb-6">
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Your name
                </label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Taranveer Singh"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none border transition-colors"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
              <div>
                <label className="block text-xs font-medium mb-1.5" style={{ color: "var(--text-secondary)" }}>
                  Email
                </label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full px-4 py-2.5 rounded-lg text-sm outline-none border transition-colors"
                  style={{
                    backgroundColor: "var(--surface)",
                    borderColor: "var(--border)",
                    color: "var(--text-primary)",
                  }}
                />
              </div>
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
              <p className="text-sm mb-4 px-4 py-3 rounded-lg" style={{ color: "#f87171", backgroundColor: "rgba(248,113,113,0.1)" }}>
                {error}
              </p>
            )}

            <button
              onClick={handleSubmit}
              disabled={!selectedFile || !name || !email}
              className="w-full py-3 rounded-lg font-medium text-sm transition-opacity disabled:opacity-40"
              style={{ backgroundColor: "var(--accent)", color: "white" }}
            >
              Analyze My Brain
            </button>

            <p className="text-xs text-center mt-4" style={{ color: "var(--text-secondary)" }}>
              Don't have a vault?{" "}
              <a href="#" style={{ color: "var(--accent)" }}>Download our starter template</a>
            </p>
          </>
        ) : (
          /* Processing / done state */
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
