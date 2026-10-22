export interface AnomalyStats {
  latest: number;
  mean: number;
  stddev: number;
  zScore: number;
  flagged: boolean;
  confidence: "high" | "medium" | "low" | "none";
}

function average(nums: number[]): number {
  if (nums.length === 0) return 0;
  return nums.reduce((sum, n) => sum + n, 0) / nums.length;
}

// Plain statistics, no AI: compares today's spend against the mean/stddev
// of the prior days for the same resource and flags it if it's an outlier.
export function analyzeSpend(dailySpend: number[]): AnomalyStats {
  const baseline = dailySpend.slice(0, -1);
  const latest = dailySpend[dailySpend.length - 1] ?? 0;
  const mean = average(baseline);
  const variance = average(baseline.map((v) => (v - mean) ** 2));
  const stddev = Math.sqrt(variance);
  const zScore = stddev === 0 ? (latest > mean ? 99 : 0) : (latest - mean) / stddev;

  let confidence: AnomalyStats["confidence"] = "none";
  let flagged = false;
  if (zScore >= 4) {
    confidence = "high";
    flagged = true;
  } else if (zScore >= 3) {
    confidence = "medium";
    flagged = true;
  } else if (zScore >= 2.5) {
    confidence = "low";
    flagged = true;
  }

  return { latest, mean, stddev, zScore, flagged, confidence };
}

// Plain math (not AI): turns the dollar overage into a rough "days of
// runway" figure using the company's mock monthly burn rate.
export function estimateRunwayDaysLost(extraSpend: number, monthlyBurn: number): number {
  const dailyBurn = monthlyBurn / 30;
  if (dailyBurn <= 0) return 0;
  return Math.round((extraSpend / dailyBurn) * 10) / 10;
}
