import type { AnomalyStats } from "./anomalyDetection";
import { formatCurrency, formatPlainDeviation } from "./format";

// A deterministic, honest bridge sentence shown the moment the real AI
// call is taking too long (Gemini's free tier can run 60s+). Not a fake
// AI answer — it only states facts already computed in plain code, and
// says plainly that it's still confirming with AI. Silently replaced by
// the real explanation the moment that arrives.
export function generateQuickRead(params: {
  resourceName: string;
  stats: AnomalyStats;
  contextNote: string;
  runwayDaysLost: number;
  // Set only for a user-set spend limit breach, not a statistical
  // anomaly — the wording needs to say "over budget," not "spiking,"
  // since the underlying spend may look completely normal.
  guardrailThresholdDollars?: number;
}): string {
  const { resourceName, stats, contextNote, runwayDaysLost, guardrailThresholdDollars } = params;
  const runwayPhrase =
    runwayDaysLost > 0 ? `about ${runwayDaysLost} day${runwayDaysLost === 1 ? "" : "s"} of runway` : "a small amount of runway";

  if (typeof guardrailThresholdDollars === "number") {
    const over = Math.max(0, stats.latest - guardrailThresholdDollars);
    return `${resourceName} crossed the ${formatCurrency(guardrailThresholdDollars)}/day limit you set — it's at ${formatCurrency(
      stats.latest
    )} today, ${formatCurrency(over)} over. That's not necessarily unusual spend for this service, just over the budget you configured. Still confirming with AI — if this continues, it could cost ${runwayPhrase}.`;
  }

  const pct = stats.mean > 0 ? ((stats.latest - stats.mean) / stats.mean) * 100 : 0;
  const plain = formatPlainDeviation(pct);
  const hint =
    contextNote && contextNote !== "No recent deploys." && !contextNote.startsWith("Added manually")
      ? ` ${contextNote}`
      : "";

  return `${resourceName} is at ${formatCurrency(stats.latest)} today, ${plain} (usually ${formatCurrency(
    stats.mean
  )}).${hint} Still confirming the likely cause with AI — if this continues, it could cost ${runwayPhrase}.`;
}
