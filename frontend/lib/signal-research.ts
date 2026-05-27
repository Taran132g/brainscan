/**
 * Research-backed explanations for each founder signal.
 * Sourced from `FindingFounders Founder Research.md` (PNAS 2023, NFX, First Round, Antler).
 * Surfaced via the SignalExplainerModal when a user taps a pill on the brain card.
 */

export type SignalKey =
  | "domain_obsession"
  | "shipped_before"
  | "emotional_stability_signal"
  | "market_orientation"
  | "implied_intelligence";

export interface SignalResearch {
  label: string;
  oneLiner: string;
  research: string;
  source: string;
  scoreImpact: string;
}

export const SIGNAL_RESEARCH: Record<SignalKey, SignalResearch> = {
  domain_obsession: {
    label: "Domain obsession",
    oneLiner: "Founder-market fit — how deeply you've thought about the problem before the company existed.",
    research:
      "Sequoia, YC, and NFX all look for an unfair informational edge in the target domain. Prior industry experience is among the top self-reported success factors (Kauffman, n=549). Startups with founder-market fit are estimated 230% more likely to grow. Every breakout young founder studied (Collison, Wang, Russell, Buterin) had 4-8 years of domain obsession BEFORE the company.",
    source: "NFX · Kauffman · YC",
    scoreImpact: "Up to +15 points to your founder rank",
  },
  shipped_before: {
    label: "Shipped before",
    oneLiner: "Have you taken something from idea to live product before? Repeat founders win more.",
    research:
      "Serial founders have a 34% success rate vs. 22% for first-timers (HBS). Antler's top operational trait is speed of execution — and the strongest predictor of speed is having shipped before. The breakout startup is rarely the first thing built: Dubugras built Pagar.me before Brex, Altman built Loopt before OpenAI, Vitalik co-founded Bitcoin Magazine before Ethereum.",
    source: "HBS · Antler",
    scoreImpact: "+10 points if yes",
  },
  emotional_stability_signal: {
    label: "Emotional stability",
    oneLiner: "Low neuroticism — the ONLY Big Five trait that predicts success across every startup stage.",
    research:
      "PNAS analyzed 10,541 founders. Low neuroticism (emotional stability) is the only Big Five personality trait that predicts positive outcomes across all startup stages. High-neuroticism founders raised ~$90K less in early rounds and had 16% lower exit odds. Every other trait (openness, conscientiousness, extraversion) helped at some stages but hurt at others. This one only ever helps.",
    source: "PNAS (2023), n=10,541",
    scoreImpact: "Up to +10 points; -10 penalty if low",
  },
  market_orientation: {
    label: "Market orientation",
    oneLiner: "What kind of customer your work points at — B2B, consumer, infrastructure, or mixed.",
    research:
      "Technical co-founders correlate with +230% performance for B2B/enterprise but -31% for consumer (First Round). Young breakout founders cluster overwhelmingly in B2B infrastructure: payments (Stripe, Brex), AI data (Scale AI), voice infra (ElevenLabs), design tooling (Figma), blockchain (Ethereum). Almost none start with consumer apps. Picks and shovels, not end-user content.",
    source: "First Round 10-Year Study · Nature Sci. Reports",
    scoreImpact: "Surfaces co-founder complementarity signals",
  },
  implied_intelligence: {
    label: "Implied intelligence",
    oneLiner: "Conceptual depth and reasoning quality extracted from your actual writing.",
    research:
      "Openness — and the conceptual flexibility it implies — shows a 5% higher likelihood of raising initial funding (PNAS). First Round's explicit hiring criterion is 'compelling and contrarian insight into how the world works.' This signal is the only one in your brain card derived purely from how you think on the page, not from your resume.",
    source: "PNAS (2023) · First Round Review",
    scoreImpact: "Up to +6 points to your founder rank",
  },
};
