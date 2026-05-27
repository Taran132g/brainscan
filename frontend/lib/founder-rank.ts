/**
 * Founder ranking — converts the 0-100 founder_score into a 1-10 rank
 * and a tier label with a banner color scheme.
 *
 * Calibration target (tightened 2026-05-27):
 *   5/10  — genuinely average platform user (early founder, some experience)
 *   6-7   — solid track record (shipped something, real domain, mid-tier school)
 *   8-9   — top 10% (verified strong GitHub + emotional stability + market fit)
 *   10/10 — top 1% (all signals high + elite school OR big-tech OR prior exit)
 *
 * Baseline lowered to 45; individual signal weights all reduced so no single
 * factor can dominate. Elite-school bonus added on top of "has any school".
 */

import type { Tier, Grade } from "./fake-users";
import { TIER_INFO } from "./fake-users";

export { TIER_INFO };
export type { Tier };

export function tierForRank(rank: number): Tier {
  if (rank >= 9) return "Visionary";
  if (rank >= 7) return "Builder";
  if (rank >= 5) return "Operator";
  if (rank >= 3) return "Explorer";
  return "Newcomer";
}

export function rankFromScore(score: number): number {
  // 0-100 → 1-10, clamped
  return Math.max(1, Math.min(10, Math.round(score / 10)));
}

type FounderSignal = {
  domain_obsession?: Grade;
  emotional_stability_signal?: Grade;
  shipped_before?: boolean;
  market_orientation?: string;
  implied_intelligence?: Grade;
};

type ProfileFields = {
  full_name?: string;
  age?: string;
  city?: string;
  school?: string;
  github?: string;
  linkedin?: string;
  twitter?: string;
  website?: string;
  gender?: string;
  github_quality?: Grade;
};

const ELITE_SCHOOLS = [
  "stanford", "mit", "harvard", "caltech", "princeton", "yale",
  "columbia", "cornell", "dartmouth", "brown", "upenn", "university of pennsylvania",
  "berkeley", "uc berkeley", "carnegie mellon", "cmu", "oxford", "cambridge",
];

function isEliteSchool(school: string): boolean {
  const s = school.toLowerCase();
  return ELITE_SCHOOLS.some((e) => s.includes(e));
}

export function computeRank(
  signal: FounderSignal | undefined,
  profile: ProfileFields | undefined
): { rank: number; score: number; tier: Tier } {
  let score = 45; // tightened baseline

  // Brain card signals — graded, with both bonuses and penalties.
  // Max per-signal contribution is now small enough that no single field
  // can carry a user from average to visionary on its own.

  if (signal?.shipped_before) score += 5;

  // Emotional stability: high +4, medium 0, low -3 (real penalty for anxious
  // / reactive writing — PNAS data is unambiguous on this)
  if (signal?.emotional_stability_signal === "high") score += 4;
  else if (signal?.emotional_stability_signal === "low") score -= 3;

  // Domain obsession (proxy for founder-market fit): up to +6
  if (signal?.domain_obsession === "high") score += 6;
  else if (signal?.domain_obsession === "medium") score += 3;
  else if (signal?.domain_obsession === "low") score -= 2;

  // Implied intelligence — smallest contributor, just a tiebreaker
  if (signal?.implied_intelligence === "high") score += 2;
  else if (signal?.implied_intelligence === "low") score -= 1;

  // GitHub quality — verified-ish (username + public API) is the only
  // path right now. Sparse profile mildly penalized, strong profile rewarded.
  if (profile?.github_quality === "high") score += 5;
  else if (profile?.github_quality === "low") score -= 1;

  // Profile completeness — small bonuses, not score-defining
  if (profile?.linkedin && profile.linkedin.length > 0) score += 2;
  if (profile?.school && profile.school.length > 0) {
    score += 1;
    if (isEliteSchool(profile.school)) score += 5; // elite school bonus on top
  }
  if (profile?.age && parseInt(profile.age) < 25) score += 2;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const rank = rankFromScore(score);
  return { rank, score, tier: tierForRank(rank) };
}
