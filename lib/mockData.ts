export interface SpendResource {
  id: string;
  name: string;
  dailySpend: number[]; // oldest -> newest, last entry is "today"
  contextNote: string;
}

// Mock total company burn, used only to turn an overage into a
// rough "days of runway" figure for the AI explanation.
export const COMPANY_MONTHLY_BURN = 45000;

const AI_API_BASELINE = [1180, 1220, 1190, 1240, 1205, 1260, 1215, 1230, 1195, 1250, 1210, 1225, 1200];
const WEB_SERVERS = [95, 102, 98, 101, 97, 103, 99, 100, 96, 104, 98, 101, 99, 100];
const STAGING_ENV = [14, 16, 15, 17, 15, 16, 14, 18, 15, 16, 15, 17, 16, 15];

export type Scenario = "spike" | "calm";

export function getScenario(scenario: Scenario): SpendResource[] {
  const aiApiSpend =
    scenario === "spike"
      ? [...AI_API_BASELINE, 4080] // the seeded 340% overnight jump
      : [...AI_API_BASELINE, 1235]; // a normal day, no spike

  return [
    {
      id: "ai-api",
      name: "AI API (LLM provider usage)",
      dailySpend: aiApiSpend,
      contextNote:
        scenario === "spike"
          ? "Checkout service was redeployed about 6 hours before this spike — possible retry loop."
          : "No recent deploys.",
    },
    {
      id: "web-servers",
      name: "EC2 Web Servers",
      dailySpend: WEB_SERVERS,
      contextNote: "No recent deploys.",
    },
    {
      id: "staging-env",
      name: "Staging Environment",
      dailySpend: STAGING_ENV,
      contextNote: "Idle most nights; expected low usage.",
    },
  ];
}
