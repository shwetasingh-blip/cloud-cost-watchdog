import { NextRequest, NextResponse } from "next/server";
import { getServiceDef, COMPANY_MONTHLY_BURN } from "@/lib/mockData";
import { analyzeSpend, estimateRunwayDaysLost } from "@/lib/anomalyDetection";
import { explainAnomaly } from "@/lib/ai";

// Called once, only when the client's own (plain-code) anomaly check
// flags a resource. Takes the resource id and its current spend
// history, recomputes the stats server-side (never trusts a client-sent
// verdict), and asks Gemini to explain it.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const resourceId = body?.resourceId;
    const dailySpend = body?.dailySpend;

    if (!resourceId || typeof resourceId !== "string" || !Array.isArray(dailySpend)) {
      return NextResponse.json({ error: "Missing resourceId or dailySpend." }, { status: 400 });
    }

    const service = getServiceDef(resourceId);
    if (!service) {
      return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
    }

    const stats = analyzeSpend(dailySpend);
    const extraSpend = Math.max(0, stats.latest - stats.mean);
    const runwayDaysLost = estimateRunwayDaysLost(extraSpend, COMPANY_MONTHLY_BURN);

    try {
      const ai = await explainAnomaly({
        resourceName: service.name,
        dailySpend,
        stats,
        contextNote: service.contextNote,
        runwayDaysLost,
      });
      return NextResponse.json({ stats, explanation: ai.explanation, verdict: ai.verdict, aiError: false });
    } catch {
      return NextResponse.json({
        stats,
        explanation: "AI explanation unavailable — showing raw signal only.",
        verdict: "unclear",
        aiError: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not process explain request." }, { status: 500 });
  }
}
