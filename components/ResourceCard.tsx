import type { CSSProperties } from "react";
import SpendChart from "./SpendChart";
import type { ResourceResult } from "@/lib/types";

interface ResourceCardProps {
  resource: ResourceResult;
  onPause: (id: string) => void;
  pausing: boolean;
}

function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K tokens`;
  return `${Math.round(tokens)} tokens`;
}

export default function ResourceCard({ resource, onPause, pausing }: ResourceCardProps) {
  const { stats } = resource;
  const percentChange = stats.mean > 0 ? ((stats.latest - stats.mean) / stats.mean) * 100 : 0;
  const latestValue = resource.dailySpend[resource.dailySpend.length - 1];
  const tokensToday =
    resource.unit === "tokens" && resource.costPerUnit ? latestValue / resource.costPerUnit : null;

  let variant: "neutral" | "alert" | "growth" | "paused" = "neutral";
  if (resource.paused) variant = "paused";
  else if (stats.flagged && resource.verdict === "likely_growth") variant = "growth";
  else if (stats.flagged) variant = "alert";

  const accentColor = { neutral: "transparent", alert: "#ff3b30", growth: "#ff9500", paused: "#34c759" }[variant];

  return (
    <div className="resource" style={{ "--accent": accentColor } as CSSProperties}>
      <div className="resource__main">
        <div className="resource__top">
          <span className="resource__name">{resource.name}</span>
          {resource.paused && <span className="pill pill--green">Paused</span>}
          {!resource.paused && stats.flagged && (
            <span className={`pill ${variant === "growth" ? "pill--amber" : "pill--red"}`}>
              {percentChange >= 0 ? "+" : ""}
              {percentChange.toFixed(0)}%
            </span>
          )}
        </div>

        {tokensToday !== null && (
          <p className="resource__tokens">{formatTokens(tokensToday)} today</p>
        )}

        {!stats.flagged && !resource.paused && <p className="resource__meta">Within normal range</p>}

        {resource.paused && <p className="resource__meta resource__meta--green">Paused, spend stopped</p>}

        {stats.flagged && !resource.paused && resource.explaining && (
          <div className="callout callout--thinking">
            <span className="callout__badge">AI</span>
            <p className="callout__text">Reading the numbers…</p>
          </div>
        )}

        {stats.flagged && !resource.paused && !resource.explaining && resource.explanation && (
          <>
            <div className="callout">
              <span className="callout__badge">AI</span>
              <p className="callout__text">{resource.explanation}</p>
            </div>
            <p className="resource__fineprint">
              ${stats.latest.toFixed(0)} today, usually around ${stats.mean.toFixed(0)} (confidence: {stats.confidence})
            </p>
            <button className="btn btn--pause" onClick={() => onPause(resource.id)} disabled={pausing}>
              {pausing ? "Pausing…" : "Pause"}
            </button>
          </>
        )}
      </div>

      <div className="resource__chart">
        <SpendChart data={resource.dailySpend} variant={variant} gradientId={`grad-${resource.id}`} />
        <span className="resource__value">${latestValue.toFixed(0)}</span>
      </div>
    </div>
  );
}
