import { ShieldAlert } from "lucide-react";

type Sections = Record<string, string>;
type Signal = Record<string, string | boolean>;

const DOMAIN_LABEL: Record<string, string> = {
  founder: "Founder",
  career: "Career",
  relationships: "Relationships",
};

const DOMAIN_ACCENT: Record<string, string> = {
  founder: "#10b981",
  career: "#3b82f6",
  relationships: "#ec4899",
};

function humanize(key: string): string {
  const s = key.replace(/_/g, " ");
  return s.charAt(0).toUpperCase() + s.slice(1);
}

function valueLabel(v: string | boolean): string {
  if (typeof v === "boolean") return v ? "yes" : "no";
  return v;
}

/**
 * Generic card for any scan domain — renders its sections + signal chips.
 * Domain-agnostic: founder / career / relationships all flow through here.
 */
export function ScanCard({
  domain,
  sections,
  signal,
  disclaimer,
  scannedAt,
}: {
  domain: string;
  sections: Sections;
  signal?: Signal;
  disclaimer?: string;
  scannedAt?: string | null;
}) {
  const accent = DOMAIN_ACCENT[domain] ?? "var(--accent)";
  const label = DOMAIN_LABEL[domain] ?? humanize(domain);
  const when = scannedAt ? new Date(scannedAt).toLocaleDateString(undefined, { month: "short", day: "numeric", year: "numeric" }) : null;

  return (
    <div
      className="rounded-2xl border overflow-hidden card-hover"
      style={{ backgroundColor: "var(--surface)", borderColor: "var(--border)" }}
    >
      {/* Header */}
      <div className="flex items-center justify-between gap-3 px-6 py-4 border-b" style={{ borderColor: "var(--border)" }}>
        <div className="flex items-center gap-2">
          <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accent }} />
          <span className="font-display font-bold text-lg" style={{ color: "var(--text-primary)" }}>{label} scan</span>
        </div>
        {when && <span className="text-xs" style={{ color: "var(--text-secondary)" }}>scanned {when}</span>}
      </div>

      {/* Non-clinical / sensitive disclaimer */}
      {disclaimer && (
        <div
          className="flex items-start gap-2 px-6 py-3 text-xs"
          style={{ backgroundColor: "rgba(245,158,11,0.08)", color: "#fbbf24", borderBottom: "1px solid var(--border)" }}
        >
          <ShieldAlert size={14} className="flex-shrink-0 mt-0.5" />
          <span>{disclaimer}</span>
        </div>
      )}

      {/* Signal chips */}
      {signal && Object.keys(signal).length > 0 && (
        <div className="flex flex-wrap gap-2 px-6 pt-5">
          {Object.entries(signal).map(([k, v]) => (
            <span
              key={k}
              className="text-xs px-2.5 py-1 rounded-full border"
              style={{ borderColor: "var(--border)", color: "var(--text-secondary)" }}
            >
              {humanize(k)}: <span className="font-semibold" style={{ color: accent }}>{valueLabel(v)}</span>
            </span>
          ))}
        </div>
      )}

      {/* Sections */}
      <div className="flex flex-col gap-4 p-6">
        {Object.entries(sections).map(([title, body]) => (
          <div key={title}>
            <div className="text-sm font-semibold mb-1" style={{ color: accent }}>{title}</div>
            <p className="text-sm leading-relaxed" style={{ color: "var(--text-secondary)" }}>{body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}
