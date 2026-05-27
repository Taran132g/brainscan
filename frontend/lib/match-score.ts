/**
 * Lightweight client-side compatibility scoring between two brain cards.
 * Used by the MatchPanel that appears when a signed-in visitor lands on
 * someone else's profile page. Not a real matching algorithm — just enough
 * to make the share moment feel substantive ("My match with @alex is 78/100").
 */

type Grade = "low" | "medium" | "high";
type Signal = {
  domain_obsession?: Grade;
  shipped_before?: boolean;
  emotional_stability_signal?: Grade;
  market_orientation?: string;
  implied_intelligence?: Grade;
};

const GRADE: Record<Grade, number> = { low: 0, medium: 0.5, high: 1 };

export type PairVerdict = "aligned" | "complementary" | "mismatch" | "unknown";

export interface PairResult {
  label: string;
  hostValue: string;
  viewerValue: string;
  verdict: PairVerdict;
  note: string;
}

export interface MatchSummary {
  score: number; // 0-100
  pairs: PairResult[];
  headline: string;
}

function gradePair(label: string, host?: Grade, viewer?: Grade, complementaryIsGood = false): PairResult | null {
  if (!host || !viewer) return null;
  const diff = Math.abs(GRADE[host] - GRADE[viewer]);
  let verdict: PairVerdict;
  let note: string;
  if (diff === 0) {
    verdict = "aligned";
    note = host === "high" ? "Both bring it." : host === "medium" ? "Even match." : "Both light here.";
  } else if (diff === 0.5) {
    verdict = complementaryIsGood ? "complementary" : "aligned";
    note = complementaryIsGood ? "One stronger — covers the gap." : "Close enough.";
  } else {
    verdict = complementaryIsGood ? "complementary" : "mismatch";
    note = complementaryIsGood ? "One brings it, one doesn't — could work." : "Wide gap.";
  }
  return { label, hostValue: host, viewerValue: viewer, verdict, note };
}

export function scoreMatch(host: Signal, viewer: Signal): MatchSummary {
  const pairs: PairResult[] = [];

  const dom = gradePair("Domain obsession", host.domain_obsession, viewer.domain_obsession);
  if (dom) pairs.push(dom);

  const ies = gradePair("Emotional stability", host.emotional_stability_signal, viewer.emotional_stability_signal);
  if (ies) pairs.push(ies);

  const intel = gradePair("Implied intelligence", host.implied_intelligence, viewer.implied_intelligence, true);
  if (intel) pairs.push(intel);

  // Shipped before — complementary signal: one yes covers execution
  if (host.shipped_before !== undefined && viewer.shipped_before !== undefined) {
    const eitherShipped = host.shipped_before || viewer.shipped_before;
    const bothShipped = host.shipped_before && viewer.shipped_before;
    pairs.push({
      label: "Shipped before",
      hostValue: host.shipped_before ? "yes" : "no",
      viewerValue: viewer.shipped_before ? "yes" : "no",
      verdict: bothShipped ? "aligned" : eitherShipped ? "complementary" : "mismatch",
      note: bothShipped
        ? "Both have shipped. Execution risk: low."
        : eitherShipped
        ? "One has shipped — execution covered."
        : "Neither has shipped. First product is the test.",
    });
  }

  // Market orientation
  if (host.market_orientation && viewer.market_orientation) {
    const same = host.market_orientation === viewer.market_orientation;
    pairs.push({
      label: "Market orientation",
      hostValue: host.market_orientation,
      viewerValue: viewer.market_orientation,
      verdict: same ? "aligned" : host.market_orientation === "mixed" || viewer.market_orientation === "mixed" ? "complementary" : "mismatch",
      note: same ? "Same instinct on who you build for." : "Different markets in mind — talk it through.",
    });
  }

  // Score: aligned=1, complementary=0.7, mismatch=0.3
  const W: Record<PairVerdict, number> = { aligned: 1, complementary: 0.7, mismatch: 0.3, unknown: 0.5 };
  const score = pairs.length === 0 ? 50 : Math.round((pairs.reduce((s, p) => s + W[p.verdict], 0) / pairs.length) * 100);

  let headline: string;
  if (score >= 80) headline = "Strong fit. Worth a real conversation.";
  else if (score >= 60) headline = "Workable match. Some gaps worth probing.";
  else if (score >= 40) headline = "Mixed signals. Could complement if you're honest about the gaps.";
  else headline = "Tough fit on paper. Maybe better as friends.";

  return { score, pairs, headline };
}
