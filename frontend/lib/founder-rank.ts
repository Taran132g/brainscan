/**
 * Founder ranking — converts the 0-100 founder_score into a 1-10 rank
 * and a tier label with a banner color scheme.
 *
 * Used both for fake-user generation (lib/fake-users.ts seeds rank/tier
 * directly) and for live users — we compute their rank from brain card
 * signals + profile fields.
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

/**
 * Lightweight client-side rank computation for a live user.
 *
 * Mirrors backend/services/founder_score.py weighting but uses only the
 * signals we have client-side today:
 * - Brain card signals (domain_obsession, shipped_before, emotional_stability,
 *   implied_intelligence)
 * - Profile fields when filled in (github username, linkedin url, school,
 *   prior_shipped_product flag — derived from shipped_before for now)
 *
 * Score is capped at 100. Baseline 50.
 */
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
};

const GRADED_MAX = { high: 1.0, medium: 0.5, low: 0 } as const;

export function computeRank(
  signal: FounderSignal | undefined,
  profile: ProfileFields | undefined
): { rank: number; score: number; tier: Tier } {
  let score = 50;

  if (signal?.shipped_before) score += 10;

  if (signal?.emotional_stability_signal) {
    score += 10 * GRADED_MAX[signal.emotional_stability_signal];
    if (signal.emotional_stability_signal === "low") score -= 10; // explicit penalty
  }

  if (signal?.domain_obsession) {
    // Domain obsession contributes to founder-market fit (up to 15 pts)
    score += 15 * GRADED_MAX[signal.domain_obsession];
  }

  if (signal?.implied_intelligence) {
    score += 6 * GRADED_MAX[signal.implied_intelligence];
  }

  // Profile signals
  if (profile?.github && profile.github.length > 0) score += 8; // partial credit, real github_quality needs API
  if (profile?.linkedin && profile.linkedin.length > 0) score += 6;
  if (profile?.school && profile.school.length > 0) score += 4;
  if (profile?.age && parseInt(profile.age) < 25) score += 5;

  score = Math.max(0, Math.min(100, Math.round(score)));
  const rank = rankFromScore(score);
  return { rank, score, tier: tierForRank(rank) };
}
