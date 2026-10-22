export type Category = "ai" | "cloud" | "other";

export interface ServiceDef {
  id: string;
  name: string;
  category: Category;
  unit?: "tokens"; // only set for services billed on token usage
  costPerUnit?: number; // $ per token, only set when unit is "tokens"
  baseline: number[]; // 13 days of fixed historical spend, oldest -> newest
  contextNote: string;
}

export const CATEGORY_LABELS: Record<Category, string> = {
  ai: "AI / LLM providers",
  cloud: "Cloud infrastructure",
  other: "Other",
};

export const COMPANY_MONTHLY_BURN = 45000;

// The resource that gets a seeded spike when the user triggers the
// simulation, so the "magic moment" always fires on the service a
// non-technical founder would expect it on.
export const SPIKE_TARGET_ID = "openai";
export const SPIKE_TARGET_VALUE = 4080;

export const SERVICE_CATALOG: ServiceDef[] = [
  {
    id: "openai",
    name: "OpenAI API (GPT-4o)",
    category: "ai",
    unit: "tokens",
    costPerUnit: 0.000005,
    baseline: [1180, 1220, 1190, 1240, 1205, 1260, 1215, 1230, 1195, 1250, 1210, 1225, 1200],
    contextNote: "Checkout service was redeployed about 6 hours ago — possible retry loop.",
  },
  {
    id: "claude",
    name: "Anthropic Claude API",
    category: "ai",
    unit: "tokens",
    costPerUnit: 0.000006,
    baseline: [175, 182, 178, 185, 180, 183, 177, 186, 179, 184, 181, 178, 182],
    contextNote: "No recent deploys.",
  },
  {
    id: "ec2",
    name: "AWS EC2 (production servers)",
    category: "cloud",
    baseline: [95, 102, 98, 101, 97, 103, 99, 100, 96, 104, 98, 101, 99],
    contextNote: "No recent deploys.",
  },
  {
    id: "s3",
    name: "AWS S3 (storage)",
    category: "cloud",
    baseline: [38, 41, 39, 42, 40, 43, 38, 44, 39, 42, 40, 41, 39],
    contextNote: "Storage grows slowly and predictably.",
  },
  {
    id: "vercel",
    name: "Vercel (hosting)",
    category: "other",
    baseline: [14, 16, 15, 17, 15, 16, 14, 18, 15, 16, 15, 17, 16],
    contextNote: "Flat hosting plan, rarely changes.",
  },
];

export function getServiceDef(id: string): ServiceDef | undefined {
  return SERVICE_CATALOG.find((s) => s.id === id);
}

function average(nums: number[]): number {
  return nums.reduce((sum, n) => sum + n, 0) / (nums.length || 1);
}

// The starting "today" value for each service: close to its own
// baseline average, with a touch of noise so it isn't perfectly flat
// on first load.
export function initialDailySpend(service: ServiceDef): number[] {
  const mean = average(service.baseline);
  const today = mean + (Math.random() - 0.5) * mean * 0.02;
  return [...service.baseline, Math.max(0, today)];
}

// One live tick: nudges today's value with small random noise, gently
// pulled back toward the baseline average so a long demo session
// doesn't drift away from realistic numbers. The 13 historical days
// never change.
export function tickLiveSpend(dailySpend: number[]): number[] {
  const baseline = dailySpend.slice(0, -1);
  const mean = average(baseline);
  const last = dailySpend[dailySpend.length - 1];
  const noise = (Math.random() - 0.5) * 2 * mean * 0.012;
  const reversion = (mean - last) * 0.08;
  const next = Math.max(0, last + noise + reversion);
  return [...baseline, next];
}

// Moves today's value a fraction of the way toward a target, for an
// animated climb instead of an instant jump. Returns the new value and
// whether it has effectively arrived.
export function stepToward(current: number, target: number): { value: number; arrived: boolean } {
  const next = current + (target - current) * 0.45;
  const arrived = Math.abs(target - next) < Math.max(1, target * 0.01);
  return { value: arrived ? target : next, arrived };
}
