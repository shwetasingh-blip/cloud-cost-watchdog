import { NextRequest, NextResponse } from "next/server";
import { getScenario, COMPANY_MONTHLY_BURN, Scenario } from "@/lib/mockData";
import { analyzeSpend, estimateRunwayDaysLost } from "@/lib/anomalyDetection";
import { explainAnomaly } from "@/lib/ai";
import type { ResourceResult } from "@/lib/types";

export async function GET(req: NextRequest) {
  try {
    const scenarioParam = req.nextUrl.searchParams.get("scenario");
    const scenario: Scenario = scenarioParam === "calm" ? "calm" : "spike";
    const resources = getScenario(scenario);

    if (!resources || resources.length === 0) {
      return NextResponse.json({ resources: [] });
    }

    const results: ResourceResult[] = await Promise.all(
      resources.map(async (resource) => {
        const stats = analyzeSpend(resource.dailySpend);

        let explanation: string | undefined;
        let verdict: ResourceResult["verdict"];
        let aiError = false;

        if (stats.flagged) {
          const extraSpend = Math.max(0, stats.latest - stats.mean);
          const runwayDaysLost = estimateRunwayDaysLost(extraSpend, COMPANY_MONTHLY_BURN);

          try {
            const ai = await explainAnomaly({
              resourceName: resource.name,
              dailySpend: resource.dailySpend,
              stats,
              contextNote: resource.contextNote,
              runwayDaysLost,
            });
            explanation = ai.explanation;
            verdict = ai.verdict;
          } catch {
            aiError = true;
            explanation = "AI explanation unavailable — showing raw signal only.";
            verdict = "unclear";
          }
        }

        return {
          id: resource.id,
          name: resource.name,
          dailySpend: resource.dailySpend,
          stats,
          explanation,
          verdict,
          aiError,
          paused: false,
        };
      })
    );

    return NextResponse.json({ resources: results });
  } catch {
    return NextResponse.json({ error: "Could not load spend data." }, { status: 500 });
  }
}
