"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { SIGNAL_RESEARCH, type SignalKey } from "@/lib/signal-research";

interface Props {
  signalKey: SignalKey | null;
  value: string | null;
  onClose: () => void;
}

const VALUE_COLOR: Record<string, string> = {
  high: "#10b981",
  yes: "#10b981",
  medium: "#f59e0b",
  low: "#f87171",
  no: "#f87171",
};

export function SignalExplainerModal({ signalKey, value, onClose }: Props) {
  // Close on Escape
  useEffect(() => {
    if (!signalKey) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [signalKey, onClose]);

  if (!signalKey) return null;
  const research = SIGNAL_RESEARCH[signalKey];
  if (!research) return null;

  const displayValue = value ?? "—";
  const valueColor = VALUE_COLOR[displayValue.toLowerCase()] ?? "#a78bfa";

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      style={{ backgroundColor: "rgba(0,0,0,0.65)", backdropFilter: "blur(6px)" }}
      onClick={onClose}
      role="dialog"
      aria-modal="true"
    >
      <div
        className="relative w-full max-w-lg rounded-2xl border overflow-hidden"
        style={{
          backgroundColor: "#0a0a0f",
          backgroundImage:
            "radial-gradient(circle at 20% 0%, rgba(99,102,241,0.18) 0%, transparent 55%), radial-gradient(circle at 80% 100%, rgba(139,92,246,0.14) 0%, transparent 55%)",
          borderColor: "rgba(148,163,184,0.2)",
          color: "white",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <button
          type="button"
          onClick={onClose}
          className="absolute top-4 right-4 p-1.5 rounded-lg transition-colors"
          style={{ color: "#94a3b8" }}
          aria-label="Close"
        >
          <X size={18} />
        </button>

        <div className="p-7">
          <div className="flex items-center gap-3 mb-2">
            <span
              className="inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold border"
              style={{
                color: valueColor,
                borderColor: valueColor + "55",
                backgroundColor: valueColor + "1a",
              }}
            >
              {displayValue}
            </span>
            <span className="text-xs uppercase tracking-wider" style={{ color: "#94a3b8" }}>
              Your level
            </span>
          </div>

          <h2 className="text-2xl font-bold mb-2">{research.label}</h2>
          <p className="mb-5" style={{ color: "#cbd5e1" }}>
            {research.oneLiner}
          </p>

          <div
            className="mb-5 p-4 rounded-xl border text-sm leading-relaxed"
            style={{
              backgroundColor: "rgba(255,255,255,0.03)",
              borderColor: "rgba(148,163,184,0.2)",
              color: "#e2e8f0",
            }}
          >
            {research.research}
          </div>

          <div className="flex items-center justify-between text-xs" style={{ color: "#94a3b8" }}>
            <span>
              <span className="uppercase tracking-wider mr-2">Source</span>
              <span style={{ color: "#cbd5e1" }}>{research.source}</span>
            </span>
            <span style={{ color: "#a78bfa" }}>{research.scoreImpact}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
