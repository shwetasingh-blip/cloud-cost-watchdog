import type { AnomalyStats } from "./anomalyDetection";
import type { Category } from "./mockData";

export type Verdict = "likely_waste" | "likely_growth" | "unclear";

export interface ResourceResult {
  id: string;
  name: string;
  category: Category;
  unit?: "tokens";
  costPerUnit?: number;
  dailySpend: number[];
  stats: AnomalyStats;
  explanation?: string;
  verdict?: Verdict;
  aiError?: boolean;
  explaining?: boolean;
  paused: boolean;
}
