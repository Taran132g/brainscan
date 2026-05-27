/**
 * Adapter from backend `/api/discover/founders` payload into the FakeUser shape
 * the discovery page + globe already consume. Real users get geocoded by matching
 * their `city` string against the HUBS list (closest by substring); failure
 * falls back to SF with a 0-rank dot so they still appear without crashing.
 */

import { HUBS, type FakeUser, type Tier, type Grade, type Market } from "./fake-users";
import { computeRank } from "./founder-rank";

type ApiFounder = {
  id: string;
  name: string;
  city: string;
  brain_confidence: number | null;
  founder_signal: {
    domain_obsession?: Grade;
    emotional_stability_signal?: Grade;
    shipped_before?: boolean;
    market_orientation?: Market | string;
    implied_intelligence?: Grade;
  };
  school?: string | null;
  age?: string | null;
  linkedin?: string | null;
};

function pickHubForCity(city: string): (typeof HUBS)[number] {
  if (!city) return HUBS[0];
  const lower = city.toLowerCase();
  // Substring match — "Pittsburgh, PA" → Pittsburgh hub
  const exact = HUBS.find((h) => lower.includes(h.city.toLowerCase()));
  if (exact) return exact;
  // No match: spread across hubs deterministically by name hash
  let hash = 0;
  for (let i = 0; i < city.length; i++) hash = (hash * 31 + city.charCodeAt(i)) | 0;
  return HUBS[Math.abs(hash) % HUBS.length];
}

function jitter(value: number, amount: number, seed: number): number {
  // Deterministic per-user jitter so dots don't pile up on top of each other.
  const t = Math.sin(seed) * 10000;
  const r = t - Math.floor(t); // 0..1
  return value + (r - 0.5) * 2 * amount;
}

export function adaptApiFounder(api: ApiFounder): FakeUser {
  const hub = pickHubForCity(api.city);
  // Hash userId for stable jitter
  let seed = 0;
  for (let i = 0; i < api.id.length; i++) seed = (seed * 33 + api.id.charCodeAt(i)) | 0;

  const rank = computeRank(api.founder_signal, {
    full_name: api.name,
    school: api.school ?? undefined,
    age: api.age ?? undefined,
    linkedin: api.linkedin ?? undefined,
  });

  return {
    id: api.id,
    name: api.name,
    city: api.city || hub.city,
    country: hub.country,
    lat: jitter(hub.lat, 0.6, seed),
    lng: jitter(hub.lng, 0.6, seed + 1),
    rank: rank.rank,
    tier: rank.tier as Tier,
    score: rank.score,
    building: "",
    market_orientation: (api.founder_signal.market_orientation as Market) || "unclear",
    domain_obsession: (api.founder_signal.domain_obsession || "medium") as Grade,
    shipped_before: !!api.founder_signal.shipped_before,
    emotional_stability: (api.founder_signal.emotional_stability_signal || "medium") as Grade,
    implied_intelligence: (api.founder_signal.implied_intelligence || "medium") as Grade,
    looking_for: "Co-founder",
  };
}

export async function fetchRealFounders(apiBase: string, limit = 200): Promise<FakeUser[]> {
  try {
    const r = await fetch(`${apiBase}/api/discover/founders?limit=${limit}`);
    if (!r.ok) return [];
    const data = (await r.json()) as { founders: ApiFounder[] };
    return (data.founders || []).map(adaptApiFounder);
  } catch {
    return [];
  }
}
