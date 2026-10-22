import type { AnomalyStats } from "./anomalyDetection";

export type Verdict = "likely_waste" | "likely_growth" | "unclear";

export interface ResourceResult {
  id: string;
  name: string;
  dailySpend: number[];
  stats: AnomalyStats;
  explanation?: string;
  verdict?: Verdict;
  aiError?: boolean;
  paused: boolean;
}
