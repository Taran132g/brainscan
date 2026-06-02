"use client";

import { FileText, Search, Sparkles, IdCard } from "lucide-react";

/**
 * "How your brain scan works" — an animated node graph of the digital brain
 * plus the RAG pipeline it runs. Pure SVG + CSS, no deps.
 */

// Deterministic node layout (no randomness → no hydration drift).
const NODES: { x: number; y: number; r: number; hot?: boolean }[] = [
  { x: 60, y: 50, r: 5 }, { x: 130, y: 30, r: 4, hot: true }, { x: 205, y: 60, r: 6 },
  { x: 285, y: 38, r: 4 }, { x: 350, y: 70, r: 5, hot: true }, { x: 95, y: 110, r: 4 },
  { x: 165, y: 95, r: 6, hot: true }, { x: 240, y: 120, r: 4 }, { x: 315, y: 105, r: 5 },
  { x: 50, y: 160, r: 5 }, { x: 125, y: 175, r: 4, hot: true }, { x: 200, y: 158, r: 6 },
  { x: 280, y: 175, r: 4 }, { x: 350, y: 150, r: 5, hot: true }, { x: 165, y: 135, r: 3 },
];

const EDGES: [number, number][] = [
  [0, 1], [1, 2], [2, 3], [3, 4], [0, 5], [1, 6], [2, 7], [4, 8],
  [5, 6], [6, 7], [7, 8], [5, 9], [6, 10], [7, 11], [8, 12], [4, 13],
  [9, 10], [10, 11], [11, 12], [12, 13], [6, 14], [11, 14], [14, 7],
];

const STEPS = [
  { icon: <FileText size={18} />, title: "Your notes & chats", body: "Every note, journal, and conversation in your vault becomes a node in your digital brain." },
  { icon: <Search size={18} />, title: "Retrieved by meaning", body: "RAG semantically searches across a dozen dimensions — how you think, connect, what drives you — pulling the most revealing passages." },
  { icon: <Sparkles size={18} />, title: "Analyzed", body: "The model reads those passages for patterns, tendencies, and the throughlines you can't see in yourself." },
  { icon: <IdCard size={18} />, title: "Your Brain Card", body: "It all distills into one honest, whole-person portrait — six sections plus your signal." },
];

export function ScanProcess() {
  return (
    <div
      className="rounded-2xl border overflow-hidden"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="px-6 pt-6 pb-2">
        <h2 className="text-lg font-bold" style={{ color: "var(--text-primary)" }}>How your brain scan works</h2>
        <p className="text-sm mt-1" style={{ color: "var(--text-secondary)" }}>
          We read your second brain the way a close friend would — but across everything you&apos;ve ever written.
        </p>
      </div>

      {/* Node graph */}
      <div className="relative" style={{ background: "radial-gradient(circle at 30% 30%, rgba(16,185,129,0.10), transparent 60%)" }}>
        <svg viewBox="0 0 400 210" className="w-full" style={{ maxHeight: 230 }} role="img" aria-label="Digital brain node graph">
          {EDGES.map(([a, b], i) => (
            <line
              key={i}
              x1={NODES[a].x} y1={NODES[a].y} x2={NODES[b].x} y2={NODES[b].y}
              stroke="rgba(148,163,184,0.25)" strokeWidth="1"
            />
          ))}
          {NODES.map((n, i) => (
            <circle
              key={i}
              cx={n.x} cy={n.y} r={n.r}
              fill={n.hot ? "var(--accent)" : "rgba(148,163,184,0.55)"}
              style={n.hot ? { animation: `nodePulse 2.4s ease-in-out ${(i % 5) * 0.3}s infinite` } : undefined}
            />
          ))}
        </svg>
      </div>

      {/* Pipeline steps */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-px" style={{ backgroundColor: "var(--border)" }}>
        {STEPS.map((s, i) => (
          <div key={s.title} className="p-5 flex flex-col gap-2" style={{ backgroundColor: "var(--surface)" }}>
            <div className="flex items-center gap-2">
              <span className="flex items-center justify-center rounded-lg" style={{ width: 32, height: 32, backgroundColor: "var(--accent-glow)", color: "var(--accent)" }}>
                {s.icon}
              </span>
              <span className="text-[11px] font-mono" style={{ color: "var(--text-muted)" }}>0{i + 1}</span>
            </div>
            <h3 className="text-sm font-semibold" style={{ color: "var(--text-primary)" }}>{s.title}</h3>
            <p className="text-xs leading-relaxed" style={{ color: "var(--text-secondary)" }}>{s.body}</p>
          </div>
        ))}
      </div>

      <style>{`
        @keyframes nodePulse {
          0%, 100% { opacity: 0.5; transform: scale(1); transform-box: fill-box; transform-origin: center; }
          50% { opacity: 1; transform: scale(1.5); transform-box: fill-box; transform-origin: center; }
        }
      `}</style>
    </div>
  );
}
