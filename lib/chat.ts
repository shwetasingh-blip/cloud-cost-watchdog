import type { ResourceResult } from "./types";
import type { Guardrail } from "./guardrails";
import { formatCurrency, formatPercent } from "./format";

export interface ChatSpendSnapshot {
  resources: ResourceResult[];
  guardrails: Record<string, Guardrail>;
  totalSpendToday: number;
  baselineTotalToday: number;
  spendDeltaPct: number;
  monthlyBurn: number;
}

export interface ChatReply {
  type: "answer" | "clarify" | "off_topic";
  text: string;
}

// A deterministic, data-grounded answer shown immediately while the real
// AI call is still in flight (same bridge-then-upgrade pattern as anomaly
// explanations). Never invents a cause — just states the facts already on
// the dashboard, ranked by what moved the most.
export function generateQuickAnswer(snapshot: ChatSpendSnapshot): string {
  const { resources, guardrails, totalSpendToday, baselineTotalToday, spendDeltaPct } = snapshot;

  const movers = [...resources]
    .map((r) => ({ r, extra: r.stats.latest - r.stats.mean }))
    .filter((m) => m.extra > 1)
    .sort((a, b) => b.extra - a.extra);

  const overLimit = resources.filter((r) => {
    const g = guardrails[r.id];
    return g?.enabled && r.stats.latest >= g.thresholdDollars;
  });

  if (movers.length === 0 && overLimit.length === 0) {
    return `Total spend today is ${formatCurrency(totalSpendToday)}, about ${formatPercent(
      spendDeltaPct
    )} vs. the recent average (${formatCurrency(baselineTotalToday)}). Nothing is running above its usual range or over a limit you've set right now. Still pulling a fuller answer — one moment.`;
  }

  const parts: string[] = [
    `Total spend today is ${formatCurrency(totalSpendToday)}, about ${formatPercent(spendDeltaPct)} vs. usual.`,
  ];

  if (movers.length > 0) {
    const top = movers[0];
    parts.push(
      `The biggest mover is ${top.r.name} at ${formatCurrency(top.r.stats.latest)} (usually ${formatCurrency(
        top.r.stats.mean
      )}).`
    );
  }

  if (overLimit.length > 0) {
    const names = overLimit.map((r) => r.name).join(", ");
    parts.push(`${names} ${overLimit.length === 1 ? "is" : "are"} over the daily limit you set.`);
  }

  parts.push("Still confirming the likely cause with AI — one moment.");
  return parts.join(" ");
}

function buildContext(snapshot: ChatSpendSnapshot): string {
  const { resources, guardrails, totalSpendToday, baselineTotalToday, spendDeltaPct, monthlyBurn } = snapshot;

  const rows = resources.map((r) => {
    const g = guardrails[r.id];
    const overLimit = g?.enabled && r.stats.latest >= g.thresholdDollars;
    const bits = [
      `${r.name} (${r.provider}): today $${r.stats.latest.toFixed(0)}, usual $${r.stats.mean.toFixed(0)}, z-score ${r.stats.zScore.toFixed(1)}`,
      r.stats.flagged ? "statistically unusual" : "statistically normal",
      g ? `limit set at $${g.thresholdDollars.toFixed(0)}/day${overLimit ? " (currently over it)" : ""}` : "no limit set",
      r.paused ? "currently PAUSED" : null,
      r.explanation ? `existing explanation on file: "${r.explanation}"` : null,
    ].filter(Boolean);
    return `- ${bits.join("; ")}`;
  });

  return `Total monitored spend today: $${totalSpendToday.toFixed(0)} (${spendDeltaPct >= 0 ? "+" : ""}${spendDeltaPct.toFixed(
    1
  )}% vs. the recent average of $${baselineTotalToday.toFixed(0)})
Company monthly burn rate: $${monthlyBurn.toFixed(0)}

Per-service detail:
${rows.join("\n")}`;
}

// The only other place (besides anomaly explanations) that calls Gemini.
// Answers a free-text question about the company's cloud/AI spend using
// only the numbers already on the dashboard — never invents data.
export async function answerSpendQuestion(question: string, snapshot: ChatSpendSnapshot): Promise<ChatReply> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("Missing GEMINI_API_KEY");

  const prompt = `You are answering one question from a non-technical startup founder about their cloud/AI spend, inside a product called BurnWatch. You only know what's given below — never invent numbers, services, or causes that aren't in this data.

${buildContext(snapshot)}

The founder's question: "${question.slice(0, 500)}"

Decide which of these applies:
- If the question is clear and about this company's spend, answer it in ONE to THREE short, plain-English sentences, grounded only in the data above. If the data doesn't actually explain the "why" (e.g. no flagged resource, no context note), say that plainly instead of guessing a cause.
- If the question is too vague to answer from this data (e.g. "why" with no clear subject and multiple services moved), ask exactly ONE short clarifying question back instead of guessing.
- If the question has nothing to do with this company's cloud/AI spend (e.g. general chit-chat, unrelated topics), say briefly that you can only help with questions about their BurnWatch spend data.

Respond with ONLY valid JSON, no other text, in exactly this shape:
{"type": "answer" | "clarify" | "off_topic", "text": "..."}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-flash-lite-latest:generateContent?key=${apiKey}`,
    {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: { responseMimeType: "application/json" },
      }),
    }
  );

  if (!response.ok) {
    const errBody = await response.text().catch(() => "");
    throw new Error(`Gemini API error ${response.status}: ${errBody}`);
  }

  const data = await response.json();
  const text: string = data?.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
  const match = text.match(/\{[\s\S]*\}/);

  try {
    const parsed = JSON.parse(match ? match[0] : text);
    const type: ChatReply["type"] =
      parsed.type === "clarify" || parsed.type === "off_topic" ? parsed.type : "answer";
    if (typeof parsed.text === "string" && parsed.text.trim()) {
      return { type, text: parsed.text.trim() };
    }
    throw new Error("Unexpected response shape");
  } catch {
    return { type: "answer", text: text.trim() || "Gemini returned an unexpected response." };
  }
}
