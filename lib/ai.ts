import type { AnomalyStats } from "./anomalyDetection";
import type { Verdict } from "./types";

export interface AIExplanation {
  explanation: string;
  verdict: Verdict;
}

const GEMINI_MODEL = "gemini-flash-lite-latest";

function extractJson(text: string): string {
  const match = text.match(/\{[\s\S]*\}/);
  return match ? match[0] : text;
}

// The ONLY place in this app that calls an AI model (Gemini). It's only
// asked to do the one thing plain code can't: read the numbers + context
// and judge whether this looks like waste or legitimate growth, then
// explain it in one or two plain-English sentences. All the arithmetic
// (z-score, confidence, runway days) is computed in plain code beforehand
// and handed in as facts, not left for the model to calculate.
export async function explainAnomaly(params: {
  resourceName: string;
  dailySpend: number[];
  stats: AnomalyStats;
  contextNote: string;
  runwayDaysLost: number;
  // Set only when this call was triggered by a user-set spend limit, not
  // the usual statistical detection. Without this, the model sees normal
  // z-score numbers and (correctly, from its view) says "nothing's
  // unusual" — which flatly contradicts an alert the user is looking at.
  guardrailThresholdDollars?: number;
}): Promise<AIExplanation> {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error("Missing GEMINI_API_KEY");
  }

  const { resourceName, dailySpend, stats, contextNote, runwayDaysLost, guardrailThresholdDollars } = params;

  const isGuardrail = typeof guardrailThresholdDollars === "number";

  const instructionSection = isGuardrail
    ? `Today's spend is NOT necessarily statistically unusual for this resource (see the z-score above — it may be close to normal). It was flagged because it reached or crossed the manually-set daily limit of $${guardrailThresholdDollars!.toFixed(
        0
      )} that the user configured, not because of a detected irregularity. Write ONE to TWO short, plain-English sentences: say plainly that the manual spend limit was crossed and by how much, note whether the underlying spend pattern itself looks normal or unusual, and state the runway impact using the number given above.`
    : `Write ONE to TWO short, plain-English sentences a non-technical founder would understand: what's spiking, the likely cause (say "likely cause (unconfirmed):" if you are only guessing from limited context), and the runway impact using the number given above.`;

  const verdictSection = isGuardrail
    ? `Then decide: does the underlying spend pattern look like LIKELY_WASTE (something genuinely seems off, e.g. a bug or runaway process, even though it didn't trip the statistical check) or LIKELY_GROWTH (this is normal, expected spend that simply exceeds the limit you set)? If you genuinely can't tell, say UNCLEAR.`
    : `Then decide: does this look like LIKELY_WASTE (a bug, misconfiguration, runaway process) or LIKELY_GROWTH (legitimate increased usage)? If you genuinely can't tell, say UNCLEAR.`;

  const prompt = `You are looking at cloud/AI spend data for one resource at a small startup.

Resource: ${resourceName}
Last ${dailySpend.length} days of daily spend (USD): ${dailySpend.map((n) => n.toFixed(0)).join(", ")}
Today's spend: $${stats.latest.toFixed(0)}
Typical daily spend (baseline average): $${stats.mean.toFixed(0)}
How unusual today is vs. its own history (z-score): ${stats.zScore.toFixed(1)}
${isGuardrail ? `Manually-set daily spend limit for this resource: $${guardrailThresholdDollars!.toFixed(0)} (today's spend has reached or crossed this)\n` : ""}Extra context: ${contextNote || "none"}
Estimated runway impact if this continues: about ${runwayDaysLost} day(s) of runway

${instructionSection} Do not invent numbers that aren't given above.

${verdictSection}

Respond with ONLY valid JSON, no other text, in exactly this shape:
{"explanation": "...", "verdict": "likely_waste" | "likely_growth" | "unclear"}`;

  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent?key=${apiKey}`,
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

  try {
    const parsed = JSON.parse(extractJson(text));
    const verdict: Verdict =
      parsed.verdict === "likely_waste" || parsed.verdict === "likely_growth"
        ? parsed.verdict
        : "unclear";
    if (typeof parsed.explanation === "string" && parsed.explanation.trim()) {
      return { explanation: parsed.explanation.trim(), verdict };
    }
    throw new Error("Unexpected response shape");
  } catch {
    // Gemini didn't return the JSON shape we asked for — fall back to
    // showing whatever text it gave us rather than hiding the flag.
    return {
      explanation: text.trim() || "Gemini returned an unexpected response.",
      verdict: "unclear",
    };
  }
}
