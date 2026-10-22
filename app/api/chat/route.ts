import { NextRequest, NextResponse } from "next/server";
import { answerSpendQuestion, type ChatSpendSnapshot } from "@/lib/chat";
import type { ResourceResult } from "@/lib/types";
import type { Guardrail } from "@/lib/guardrails";

// Mirrors the explain route's shape: the client sends its own current
// numbers (already computed client-side by plain code, never trusted
// blindly — but there's no server-side source of truth to recompute
// against here, since the live spend simulation is client-side state).
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const question = body?.question;
    const resources = body?.resources;

    if (!question || typeof question !== "string" || !question.trim()) {
      return NextResponse.json({ error: "Missing question." }, { status: 400 });
    }
    if (!Array.isArray(resources)) {
      return NextResponse.json({ error: "Missing resources." }, { status: 400 });
    }

    const snapshot: ChatSpendSnapshot = {
      resources: resources as ResourceResult[],
      guardrails: (body?.guardrails ?? {}) as Record<string, Guardrail>,
      totalSpendToday: Number(body?.totalSpendToday) || 0,
      baselineTotalToday: Number(body?.baselineTotalToday) || 0,
      spendDeltaPct: Number(body?.spendDeltaPct) || 0,
      monthlyBurn: Number(body?.monthlyBurn) || 0,
    };

    try {
      const reply = await answerSpendQuestion(question.trim(), snapshot);
      return NextResponse.json({ ...reply, aiError: false });
    } catch {
      return NextResponse.json({
        type: "answer",
        text: "AI answer unavailable right now — showing the quick read above instead.",
        aiError: true,
      });
    }
  } catch {
    return NextResponse.json({ error: "Could not process chat request." }, { status: 500 });
  }
}
