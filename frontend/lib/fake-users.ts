/**
 * 500 deterministic fake users for the discovery globe.
 * Same 500 generated every render (seeded PRNG).
 *
 * Distribution skewed toward tech hubs with realistic lat/lng jitter.
 * Founder ranks follow a roughly normal distribution centered around 5-6.
 */

export type Tier = "Visionary" | "Builder" | "Operator" | "Explorer" | "Newcomer";
export type Grade = "low" | "medium" | "high";
export type Market = "b2b" | "consumer" | "infrastructure" | "mixed" | "unclear";

export interface FakeUser {
  id: string;
  name: string;
  city: string;
  country: string;
  lat: number;
  lng: number;
  rank: number; // 1-10
  tier: Tier;
  score: number; // 0-100
  building: string;
  market_orientation: Market;
  domain_obsession: Grade;
  shipped_before: boolean;
  emotional_stability: Grade;
  implied_intelligence: Grade;
  looking_for: string;
}

// ---------------- Seeded PRNG (Mulberry32) ----------------
function mulberry32(seed: number) {
  return function () {
    seed |= 0;
    seed = (seed + 0x6d2b79f5) | 0;
    let t = seed;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const rand = mulberry32(2026_05_22);
function pick<T>(arr: T[]): T { return arr[Math.floor(rand() * arr.length)]; }
function chance(p: number): boolean { return rand() < p; }
function jitter(value: number, amount: number): number { return value + (rand() - 0.5) * 2 * amount; }

// ---------------- Tech hubs (weighted) ----------------
// More users come from bigger hubs. Weights drive the distribution.
export const HUBS: { city: string; country: string; lat: number; lng: number; weight: number }[] = [
  { city: "San Francisco", country: "USA", lat: 37.7749, lng: -122.4194, weight: 60 },
  { city: "New York", country: "USA", lat: 40.7128, lng: -74.006, weight: 55 },
  { city: "London", country: "UK", lat: 51.5074, lng: -0.1278, weight: 45 },
  { city: "Bangalore", country: "India", lat: 12.9716, lng: 77.5946, weight: 40 },
  { city: "Berlin", country: "Germany", lat: 52.52, lng: 13.405, weight: 30 },
  { city: "Singapore", country: "Singapore", lat: 1.3521, lng: 103.8198, weight: 28 },
  { city: "Toronto", country: "Canada", lat: 43.6532, lng: -79.3832, weight: 25 },
  { city: "Tel Aviv", country: "Israel", lat: 32.0853, lng: 34.7818, weight: 25 },
  { city: "Boston", country: "USA", lat: 42.3601, lng: -71.0589, weight: 22 },
  { city: "Seattle", country: "USA", lat: 47.6062, lng: -122.3321, weight: 22 },
  { city: "Austin", country: "USA", lat: 30.2672, lng: -97.7431, weight: 20 },
  { city: "Los Angeles", country: "USA", lat: 34.0522, lng: -118.2437, weight: 20 },
  { city: "Paris", country: "France", lat: 48.8566, lng: 2.3522, weight: 20 },
  { city: "Amsterdam", country: "Netherlands", lat: 52.3676, lng: 4.9041, weight: 18 },
  { city: "Stockholm", country: "Sweden", lat: 59.3293, lng: 18.0686, weight: 14 },
  { city: "Tokyo", country: "Japan", lat: 35.6762, lng: 139.6503, weight: 16 },
  { city: "Seoul", country: "South Korea", lat: 37.5665, lng: 126.978, weight: 12 },
  { city: "Sydney", country: "Australia", lat: -33.8688, lng: 151.2093, weight: 12 },
  { city: "Dubai", country: "UAE", lat: 25.2048, lng: 55.2708, weight: 10 },
  { city: "São Paulo", country: "Brazil", lat: -23.5505, lng: -46.6333, weight: 12 },
  { city: "Mexico City", country: "Mexico", lat: 19.4326, lng: -99.1332, weight: 10 },
  { city: "Lagos", country: "Nigeria", lat: 6.5244, lng: 3.3792, weight: 10 },
  { city: "Nairobi", country: "Kenya", lat: -1.2921, lng: 36.8219, weight: 7 },
  { city: "Cape Town", country: "South Africa", lat: -33.9249, lng: 18.4241, weight: 7 },
  { city: "Pittsburgh", country: "USA", lat: 40.4406, lng: -79.9959, weight: 8 },
  { city: "Philadelphia", country: "USA", lat: 39.9526, lng: -75.1652, weight: 8 },
  { city: "Chicago", country: "USA", lat: 41.8781, lng: -87.6298, weight: 12 },
  { city: "Denver", country: "USA", lat: 39.7392, lng: -104.9903, weight: 10 },
  { city: "Miami", country: "USA", lat: 25.7617, lng: -80.1918, weight: 10 },
  { city: "Mumbai", country: "India", lat: 19.076, lng: 72.8777, weight: 18 },
  { city: "Delhi", country: "India", lat: 28.7041, lng: 77.1025, weight: 15 },
  { city: "Hong Kong", country: "China", lat: 22.3193, lng: 114.1694, weight: 12 },
  { city: "Shanghai", country: "China", lat: 31.2304, lng: 121.4737, weight: 14 },
  { city: "Beijing", country: "China", lat: 39.9042, lng: 116.4074, weight: 12 },
  { city: "Zurich", country: "Switzerland", lat: 47.3769, lng: 8.5417, weight: 10 },
];

function weightedPickHub() {
  const total = HUBS.reduce((s, h) => s + h.weight, 0);
  let r = rand() * total;
  for (const h of HUBS) {
    r -= h.weight;
    if (r <= 0) return h;
  }
  return HUBS[0];
}

// ---------------- Name pools ----------------
const FIRST_NAMES = [
  "Alex","Sam","Jordan","Taylor","Morgan","Casey","Riley","Drew","Avery","Quinn",
  "Sofia","Mateo","Aarav","Isla","Liam","Noah","Olivia","Emma","Mason","Ethan",
  "Yuki","Hiro","Aiko","Min-jun","Seo-yeon","Wei","Mei","Li","Chen","Ravi",
  "Priya","Anika","Rohan","Devika","Ananya","Diego","Lucia","Camila","Joaquin",
  "Pedro","Khalid","Amira","Layla","Fatima","Omar","Zara","Yusuf","Ade","Chiamaka",
  "Tunde","Wanjiku","Pieter","Lotte","Bram","Fenna","Henrik","Astrid","Ingrid","Magnus",
  "Klaus","Anna","Erik","Lukas","Mia","Felix","Pierre","Camille","Antoine","Margot",
  "Hugo","Léa","Daniel","Talia","Yael","Eitan","Noa","Tom","Maya","Liron",
  "Aditya","Vikram","Krishna","Nisha","Meera","Karthik","Tanmay","Saanvi","Ishaan","Ayaan",
];
const LAST_NAMES = [
  "Chen","Patel","Singh","Kumar","Wang","Li","Zhang","Liu","Garcia","Lopez","Martinez",
  "Rodriguez","Hernandez","Gonzalez","Sanchez","Pérez","Silva","Santos","Oliveira",
  "Smith","Johnson","Williams","Brown","Jones","Miller","Davis","Wilson","Anderson",
  "Thomas","Moore","Jackson","Martin","Lee","Thompson","White","Harris","Clark","Lewis",
  "Walker","Hall","Young","King","Wright","Hill","Scott","Green","Adams","Baker","Nelson",
  "Carter","Mitchell","Roberts","Phillips","Evans","Murphy","O'Brien","Reilly",
  "Müller","Schmidt","Schneider","Fischer","Weber","Meyer","Wagner","Becker",
  "Hoffmann","Berg","Lindgren","Nilsson","Andersson","Eriksson","Olsen",
  "Yamamoto","Tanaka","Sato","Suzuki","Takahashi","Kobayashi","Watanabe","Park","Kim",
  "Choi","Jung","Hassan","Khan","Ali","Mohammed","Ahmed","Adebayo","Okafor","Nwosu","Mbeki",
];

// ---------------- Building / looking-for pools ----------------
const BUILDING = [
  "AI agent for SMB compliance reporting",
  "Vertical AI for legal contract review",
  "Headless CMS for indie creators",
  "Carbon credit marketplace on Solana",
  "AI tutor for K-8 math",
  "B2B payments rail for emerging markets",
  "Open-source LLM serving infra",
  "Founder OS — productivity for solo builders",
  "Dev tool for AI agent observability",
  "Climate data platform for insurance pricing",
  "Healthcare workflow automation",
  "Consumer fitness app with AI coach",
  "Real estate underwriting model",
  "Synthetic data for training vision models",
  "Voice AI for restaurants",
  "DevOps copilot for small teams",
  "Vertical SaaS for dental clinics",
  "Crypto custody for non-crypto-native users",
  "Marketplace for freelance designers",
  "On-device LLM for privacy-sensitive enterprises",
  "Decentralized identity rails",
  "Education platform for trade schools",
  "Insurance for gig workers",
  "Niche social network for hobby communities",
  "AR fitting room for ecommerce",
  "AI research assistant for academics",
  "GTM agent that auto-runs founder-led sales",
  "Banking infrastructure for African SMBs",
  "Energy grid optimization with reinforcement learning",
  "Cybersecurity playbook automation",
  "Mental health journaling with AI reflection",
  "Robotics fleet management",
  "Smart home for renters",
  "Subscription analytics for SaaS",
  "Content moderation API",
];
const LOOKING_FOR = [
  "Technical co-founder, backend / infra",
  "Business co-founder with B2B sales chops",
  "Designer / front-end partner",
  "GTM co-founder for enterprise",
  "Co-founder with deep ML research background",
  "Operator who can run ops + hiring",
  "Co-founder with healthcare domain expertise",
  "Co-founder with crypto / web3 experience",
  "Solo technical founder — looking for a partner",
  "Anyone who can ship — fast",
  "Co-founder with finance / accounting background",
  "Designer with brand instincts",
  "Co-founder who can do sales-led growth",
  "Co-founder who can do product-led growth",
];

// ---------------- Rank distribution ----------------
// Roughly normal centered on rank 5-6
function pickRank(): number {
  // Box-Muller-ish: average two uniforms → bias toward middle
  const u = (rand() + rand()) / 2;
  // Stretch to 1-10
  return Math.max(1, Math.min(10, Math.round(u * 10)));
}

function tierForRank(r: number): Tier {
  if (r >= 9) return "Visionary";
  if (r >= 7) return "Builder";
  if (r >= 5) return "Operator";
  if (r >= 3) return "Explorer";
  return "Newcomer";
}

function gradeFromRank(r: number): Grade {
  if (r >= 8) return "high";
  if (r >= 4) return "medium";
  return "low";
}

function pickMarket(): Market {
  const r = rand();
  if (r < 0.35) return "b2b";
  if (r < 0.55) return "infrastructure";
  if (r < 0.78) return "consumer";
  if (r < 0.93) return "mixed";
  return "unclear";
}

// ---------------- Main builder ----------------
export const FAKE_USERS: FakeUser[] = (() => {
  const users: FakeUser[] = [];
  for (let i = 0; i < 500; i++) {
    const hub = weightedPickHub();
    const rank = pickRank();
    const first = pick(FIRST_NAMES);
    const last = pick(LAST_NAMES);
    users.push({
      id: `fake-${i.toString().padStart(3, "0")}`,
      name: `${first} ${last}`,
      city: hub.city,
      country: hub.country,
      lat: jitter(hub.lat, 0.4), // ~40km jitter so dots don't fully overlap
      lng: jitter(hub.lng, 0.4),
      rank,
      tier: tierForRank(rank),
      score: rank * 10 - Math.floor(rand() * 5),
      building: pick(BUILDING),
      market_orientation: pickMarket(),
      domain_obsession: gradeFromRank(rank + (chance(0.3) ? 1 : 0)),
      shipped_before: chance(rank / 12 + 0.1),
      emotional_stability: gradeFromRank(rank - (chance(0.3) ? 2 : 0)),
      implied_intelligence: gradeFromRank(rank + (chance(0.4) ? 1 : -1)),
      looking_for: pick(LOOKING_FOR),
    });
  }
  return users;
})();

// ---------------- Tier metadata ----------------
export const TIER_INFO: Record<Tier, { color: string; bg: string; description: string; minRank: number }> = {
  Visionary:  { color: "#fbbf24", bg: "rgba(251,191,36,0.15)", description: "Top 5% — rare combination of vision, execution, and shipped track record.", minRank: 9 },
  Builder:    { color: "#a78bfa", bg: "rgba(167,139,250,0.15)", description: "Strong execution + clear domain obsession.", minRank: 7 },
  Operator:   { color: "#60a5fa", bg: "rgba(96,165,250,0.15)", description: "Solid foundations — has shipped, can move.", minRank: 5 },
  Explorer:   { color: "#34d399", bg: "rgba(52,211,153,0.15)", description: "Early in the journey — strong potential, still building proof.", minRank: 3 },
  Newcomer:   { color: "#94a3b8", bg: "rgba(148,163,184,0.15)", description: "Just getting started — add notes, ship a project, watch your rank grow.", minRank: 1 },
};
