export interface Guardrail {
  resourceId: string;
  thresholdDollars: number; // alert if today's spend reaches or exceeds this
  enabled: boolean;
  // Auto-pause with no human tap. Default OFF everywhere. Only ever
  // offered in the UI for a user-added ("custom") platform — never for
  // the production-sounding built-ins (AWS, OpenAI, Anthropic, Vercel).
  hardStopEnabled: boolean;
}

export const GUARDRAILS_KEY = "bw_guardrails";

export function isGuardrailBreached(guardrail: Guardrail | undefined, latest: number): boolean {
  if (!guardrail || !guardrail.enabled) return false;
  return latest >= guardrail.thresholdDollars;
}

// A mocked, independent-ish usage signal shown alongside an alert so the
// explanation can be weighed against something other than cost alone —
// e.g. "requests moved about as much as spend" (consistent with either a
// bug or real growth) vs. "requests barely moved" (points toward waste).
// Stable per resource (no Math.random() in render): seeded off the id so
// it doesn't reshuffle on every re-render, but still varies per resource.
function seedFromId(id: string): number {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) >>> 0;
  return (h % 1000) / 1000; // stable 0..1
}

export function estimateRequestVolume(resourceId: string, latest: number, mean: number): { today: number; baseline: number } {
  const seed = seedFromId(`${resourceId}-req`);
  const correlation = 0.7 + seed * 0.5; // 0.7x-1.2x: requests mostly track spend, but not 1:1
  const perDollar = 15;
  return {
    today: Math.round(latest * perDollar * correlation),
    baseline: Math.round(mean * perDollar),
  };
}
