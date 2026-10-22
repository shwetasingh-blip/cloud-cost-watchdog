import { NextRequest, NextResponse } from "next/server";
import { getScenario, Scenario } from "@/lib/mockData";

// Simulated action only — no real cloud API is called. Confirms the
// resource is one we know about, then reports success so the page can
// update itself. This stays plain code: no reasoning happens here, the
// decision to pause was already made by the human clicking the button.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const resourceId = body?.resourceId;
    const scenario: Scenario = body?.scenario === "calm" ? "calm" : "spike";

    if (!resourceId || typeof resourceId !== "string") {
      return NextResponse.json({ error: "Missing resourceId." }, { status: 400 });
    }

    const resources = getScenario(scenario);
    const exists = resources.some((r) => r.id === resourceId);
    if (!exists) {
      return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
    }

    return NextResponse.json({
      success: true,
      resourceId,
      pausedAt: new Date().toISOString(),
    });
  } catch {
    return NextResponse.json({ error: "Could not process pause request." }, { status: 400 });
  }
}
