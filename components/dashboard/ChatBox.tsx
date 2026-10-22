"use client";

import { useRef, useState } from "react";
import { useResources } from "@/contexts/ResourcesContext";
import { COMPANY_MONTHLY_BURN } from "@/lib/mockData";
import { generateQuickAnswer, type ChatReply } from "@/lib/chat";

const QUICK_TIMEOUT_MS = 4500;

interface Turn {
  id: string;
  question: string;
  text: string;
  label: string;
  source: "quick" | "ai" | "clarify" | "off_topic" | "error";
}

export default function ChatBox() {
  const { resources, guardrails, totalSpendToday, baselineTotalToday, spendDeltaPct } = useResources();
  const [question, setQuestion] = useState("");
  const [turns, setTurns] = useState<Turn[]>([]);
  const [pending, setPending] = useState(false);
  const turnCounter = useRef(0);

  const ask = async () => {
    const q = question.trim();
    if (!q || pending) return;

    setQuestion("");
    setPending(true);
    const turnId = `t${++turnCounter.current}`;

    const snapshot = {
      resources,
      guardrails,
      totalSpendToday,
      baselineTotalToday,
      spendDeltaPct,
      monthlyBurn: COMPANY_MONTHLY_BURN,
    };

    let settled = false;
    const quickTimer = setTimeout(() => {
      if (settled) return;
      const quickText = generateQuickAnswer(snapshot);
      setTurns((prev) => [{ id: turnId, question: q, text: quickText, label: "Quick read — confirming with AI…", source: "quick" }, ...prev]);
    }, QUICK_TIMEOUT_MS);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: q, ...snapshot }),
      });
      const data: ChatReply & { aiError?: boolean } = await res.json();
      settled = true;
      clearTimeout(quickTimer);

      const label =
        data.type === "clarify"
          ? "Needs a bit more detail"
          : data.type === "off_topic"
          ? "Outside BurnWatch"
          : data.aiError
          ? "AI unavailable — showing what's known"
          : "AI answer";
      const source: Turn["source"] = data.aiError ? "error" : data.type === "clarify" ? "clarify" : data.type === "off_topic" ? "off_topic" : "ai";

      setTurns((prev) => {
        const withoutQuick = prev.filter((t) => t.id !== turnId);
        return [{ id: turnId, question: q, text: data.text, label, source }, ...withoutQuick];
      });
    } catch {
      settled = true;
      clearTimeout(quickTimer);
      setTurns((prev) => {
        const withoutQuick = prev.filter((t) => t.id !== turnId);
        return [
          {
            id: turnId,
            question: q,
            text: generateQuickAnswer(snapshot) + " (Couldn't reach the AI — this is the data-only read.)",
            label: "AI unavailable — showing what's known",
            source: "error",
          },
          ...withoutQuick,
        ];
      });
    } finally {
      setPending(false);
    }
  };

  return (
    <section className="panel chatbox">
      <div className="panel__head">
        <h2 className="panel__title">Ask about your bill</h2>
        <span className="panel__meta">e.g. &quot;why did my bill go up&quot;</span>
      </div>

      <form
        className="chatbox__form"
        onSubmit={(e) => {
          e.preventDefault();
          ask();
        }}
      >
        <input
          type="text"
          className="chatbox__input"
          placeholder="Ask why your spend changed…"
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          disabled={pending}
        />
        <button type="submit" className="btn-secondary" disabled={pending || !question.trim()}>
          {pending ? "Asking…" : "Ask"}
        </button>
      </form>

      {turns.length === 0 ? (
        <p className="chatbox__empty">Ask a question about today&apos;s spend and I&apos;ll answer from your actual data.</p>
      ) : (
        <div className="chatbox__thread">
          {turns.map((t) => (
            <div key={t.id} className="chatbox__turn">
              <p className="chatbox__question">{t.question}</p>
              <div className={`chatbox__answer chatbox__answer--${t.source}`}>
                <span className="chatbox__answer-label">{t.label}</span>
                <p className="chatbox__answer-text">{t.text}</p>
              </div>
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
