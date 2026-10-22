# Cloud Cost Watchdog

A hackathon MVP that catches cloud/AI spend spikes before they burn a startup's runway, explains them in plain English, and lets you stop them with one click.

## Job to be done

When a startup's cloud/AI API spend suddenly spikes without warning, I want to instantly see a plain-English explanation of what's spiking and why, so I can decide in seconds whether to pause it and protect my runway.

**User:** A solo founder or the one engineer at a small (10–20 person) startup who's become the de facto "cloud cost person," with no dedicated FinOps team.

## The 3 tests this MVP has to pass

1. **Load → see the spike.** Load the dashboard and within a few seconds see a seeded cost spike flagged with a plain-English explanation (what's spiking, likely cause, runway impact in days).
2. **Pause → see it stop.** Click **Pause** on the flagged resource and see its spend line flatten and a confirmation message appear, near-instantly.
3. **Bad / boring input → no false alarm, no crash.** When the data has no spike (a normal day), the dashboard clearly shows "You're all clear" — no false alarm, no blank/broken screen. Malformed requests to the API (unknown resource ID, invalid JSON) return a clear error instead of crashing.

All three are manually verified in [`app/page.tsx`](app/page.tsx) and the two API routes; see **How to run it locally** below to check them yourself.

## Current workflow → future workflow

| Today (manual) | With this MVP |
|---|---|
| Check native billing dashboards for which service costs the most | One dashboard, pulled automatically, covering cloud + AI spend together |
| Find out only after the invoice posts — no alerts | A statistical baseline flags anomalies the same day |
| Open the provider's cost console, which lags 1–2 days | Mock/seeded data in the MVP; a real integration would poll continuously |
| Open a support ticket to understand a spike | An AI model reads the numbers and writes a plain-English explanation in seconds |
| Manually cross-reference dashboards, ask teammates | The explanation names the likely cause directly, with a confidence signal |
| Build a spreadsheet to track this by hand | A single screen replaces the spreadsheet |
| Fix the one thing found, wait for the next surprise | One-tap Pause stops the flagged resource immediately |

## Architecture: Input → AI → Logic → Action → Output

```
Input                Logic (plain code)        AI (Gemini)              Logic (plain code)     Action          Output
-----                -------------------        -----------              -------------------     ------          ------
Seeded spend   -->   Rolling average/stddev --> Judges waste vs    -->   Confidence from     --> Pause button --> One screen:
data (2                per resource,             growth, writes            z-score (not          flips status      cards, hero
scenarios:              z-score, flags            1-2 sentence              AI self-report);       + flattens        status, AI
spike / calm)           anomalies                 explanation               picks card color        spend             explanation
```

- **Input:** [`lib/mockData.ts`](lib/mockData.ts) — two seeded 14-day spend histories per resource (`spike` has a real jump seeded in, `calm` doesn't).
- **Logic (pass 1 — detect):** [`lib/anomalyDetection.ts`](lib/anomalyDetection.ts) — plain statistics (rolling mean/stddev → z-score). Decides which resources are worth asking the AI about at all.
- **AI:** [`lib/ai.ts`](lib/ai.ts) — the *only* place in the app that calls an AI model (Gemini). Only called for resources the stats already flagged.
- **Logic (pass 2 — gate):** confidence level is computed from the z-score in plain code, not asked of the model, and combined with the AI's waste/growth verdict to decide the card's color.
- **Action:** [`app/api/pause/route.ts`](app/api/pause/route.ts) — a simulated pause (flips status, flattens future values). No AI involved; purely mechanical, and only ever triggered by a human click.
- **Output:** [`app/page.tsx`](app/page.tsx) + [`components/`](components) — the one screen: a hero status banner and a card per resource.

## Where AI is used, what stays human, and why

| Step | AI or plain code | Why |
|---|---|---|
| Load spend data | Plain code | Just reading data, no judgment needed |
| Compute z-score / anomaly flag | Plain code | Deterministic math |
| Confidence level | Plain code (not AI) | LLMs aren't well-calibrated at self-reporting confidence; the z-score already gives a real number |
| Judge "waste vs. legitimate growth" + write the explanation | **AI (Gemini)** | A z-score only says a number is unusual — deciding *why*, and writing a sentence a non-technical founder understands, needs judgment a fixed rule can't give. This is the one thing a static rule (like AWS Cost Anomaly Detection, which users describe as "noisy") can't do well |
| Pause a resource | Plain code | A status flip; the decision was already made by the human who clicked |
| What the user still decides | **Human** | Whether to trust the explanation and click Pause — the system never auto-pauses anything |

### Why these tools

- **Next.js (App Router)** — one app, API routes and UI in the same project, deploys straight to Vercel.
- **Gemini API** — called directly via `fetch` from a Next.js server route, so the API key never reaches the browser.
- **No database, no queue, no n8n/Slack** — cut from the original scope to fit "one web app, one main screen" for the hackathon timeline. (The original scope doc envisioned Slack delivery + n8n orchestration; this MVP collapses that into the web app itself.)

### Known failure cases (and how the UI handles them)

| Failure | What happens | How it's handled |
|---|---|---|
| Gemini call fails (bad key, network, rate limit) | The flagged card would have no explanation | Falls back to "AI explanation unavailable — showing raw signal only" instead of hiding the flag or crashing |
| Gemini returns malformed/non-JSON text | Parsing would throw | Falls back to showing the raw text Gemini returned, verdict marked "unclear" |
| AI names the wrong cause | A judge or user might trust a wrong guess | The raw signal (z-score, $ today vs. average) is always shown next to the AI's sentence, so it's checkable, not just asserted |
| Unknown resource ID posted to `/api/pause` | Could silently no-op | Returns `400 {"error":"Unknown resource."}` |
| Malformed JSON body to `/api/pause` | Could crash the route | Caught, returns `400 {"error":"Missing resourceId."}` |
| No spend data / empty resource list | Blank screen | Distinct "No data loaded" message, separate from "You're all clear" |

## How to run it locally

1. **Install dependencies:**
   ```bash
   npm install
   ```
2. **Add your Gemini API key.** Copy `.env.local.example` to `.env.local` (if `.env.local` doesn't already exist) and paste your key from [aistudio.google.com/apikey](https://aistudio.google.com/apikey):
   ```
   GEMINI_API_KEY=your-real-key-here
   ```
3. **Start the dev server:**
   ```bash
   npm run dev
   ```
4. Open **http://localhost:3000**. Use the **Spike demo / Calm demo** toggle at the top right to switch between the two seeded scenarios.

`.env.local` is git-ignored and is never committed — see `.gitignore`.
