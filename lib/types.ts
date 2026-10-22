import type { AnomalyStats } from "./anomalyDetection";
import type { Category } from "./mockData";

export type Verdict = "likely_waste" | "likely_growth" | "unclear";

export interface ResourceResult {
  id: string;
  name: string;
  provider: string;
  category: Category;
  unit?: "tokens";
  costPerUnit?: number;
  contextNote: string;
  dailySpend: number[];
  stats: AnomalyStats;
  explanation?: string;
  explanationSource?: "quick" | "ai"; // "quick" = deterministic bridge text while the real AI call is still in flight
  verdict?: Verdict;
  aiError?: boolean;
  explaining?: boolean;
  paused: boolean;
  flaggedAt?: number; // epoch ms, set the moment a resource is first flagged
  isCustom?: boolean; // user-added platform, not one of the 5 built-ins
  // True once an explanation has been requested specifically because this
  // resource was statistically anomalous (not just over a manual limit).
  // Lets a later, bigger statistical spike override a stale guardrail-only
  // explanation instead of being permanently blocked by "already explained."
  explainedForStats?: boolean;
}
