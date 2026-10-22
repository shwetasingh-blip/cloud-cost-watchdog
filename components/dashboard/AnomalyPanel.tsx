"use client";

import type { ResourceResult } from "@/lib/types";
import { formatCurrency, formatPlainDeviation, formatRelativeTime } from "@/lib/format";
import { estimateRunwayDaysLost } from "@/lib/anomalyDetection";
import { COMPANY_MONTHLY_BURN } from "@/lib/mockData";
import { useResources } from "@/contexts/ResourcesContext";

interface AnomalyPanelProps {
  resource: ResourceResult;
}

function aiLabel(resource: ResourceResult): string {
  if (resource.explanationSource === "quick") {
    return resource.aiError ? "Quick read — AI unavailable" : "Quick read — confirming with AI…";
  }
  if (resource.aiError) return "AI explanation unavailable";
  return "Likely cause (AI-generated, unverified)";
}

export default function AnomalyPanel({ resource }: AnomalyPanelProps) {
  const { handlePause, pausingId } = useResources();
  const { stats } = resource;
  const deviationPct = stats.mean > 0 ? ((stats.latest - stats.mean) / stats.mean) * 100 : 0;
  const severity = resource.verdict === "likely_growth" ? "warning" : "critical";
  const pausing = pausingId === resource.id;

  const extraSpend = Math.max(0, stats.latest - stats.mean);
  const hasBurnRate = COMPANY_MONTHLY_BURN > 0;
  const runwayDaysLost = hasBurnRate ? estimateRunwayDaysLost(extraSpend, COMPANY_MONTHLY_BURN) : 0;

  return (
    <div className={`anomaly-panel anomaly-panel--${severity}`}>
      <div className="anomaly-panel__header">
        <div>
          <div className="anomaly-panel__service">
            {resource.name} <span className="anomaly-panel__provider">· {resource.provider}</span>
          </div>
          <div className="anomaly-panel__meta">
            Detected {resource.flaggedAt ? formatRelativeTime(resource.flaggedAt, Date.now()) : "recently"}
          </div>
        </div>
        <span className={`status-badge status-badge--${severity}`}>
          {severity === "critical" ? "Likely waste" : "Possible growth"}
        </span>
      </div>

      {hasBurnRate ? (
        <div className="anomaly-panel__runway">
          <span className="anomaly-panel__runway-value">
            {runwayDaysLost > 0 ? `${runwayDaysLost} day${runwayDaysLost === 1 ? "" : "s"}` : "<1 day"}
          </span>
          <span className="anomaly-panel__runway-label">of runway at risk from this spike</span>
        </div>
      ) : (
        <p className="anomaly-panel__runway-fallback">
          Set a monthly burn rate in Settings to see this in days of runway instead of just dollars.
        </p>
      )}

      <div className="anomaly-panel__measurements">
        <div className="measurement">
          <span className="measurement__label">Current spend</span>
          <span className="measurement__value tabular">{formatCurrency(stats.latest)}</span>
        </div>
        <div className="measurement">
          <span className="measurement__label">Expected baseline</span>
          <span className="measurement__value tabular">{formatCurrency(stats.mean)}</span>
        </div>
        <div className="measurement">
          <span className="measurement__label">vs. usual</span>
          <span className="measurement__value measurement__value--critical">{formatPlainDeviation(deviationPct)}</span>
        </div>
      </div>

      <details className="anomaly-panel__details">
        <summary>Technical details</summary>
        <div className="anomaly-panel__details-grid">
          <div>
            <span className="measurement__label">Deviation</span>
            <span className="measurement__value tabular">
              {deviationPct >= 0 ? "+" : ""}
              {deviationPct.toFixed(1)}%
            </span>
          </div>
          <div>
            <span className="measurement__label">Z-score</span>
            <span className="measurement__value tabular">{stats.zScore.toFixed(1)}</span>
          </div>
          <div>
            <span className="measurement__label">Confidence</span>
            <span className="measurement__value">{stats.confidence}</span>
          </div>
        </div>
      </details>

      <div className="anomaly-panel__ai">
        <div className="anomaly-panel__ai-label">{aiLabel(resource)}</div>
        <p className="anomaly-panel__ai-text">{resource.explanation ?? "Reading the numbers…"}</p>
      </div>

      <div className="anomaly-panel__footer">
        <div className="anomaly-panel__recommendation">
          <span className="anomaly-panel__recommendation-label">Recommended action</span>
          Pause {resource.name} until the cause is confirmed.
        </div>
        <button className="btn-pause" onClick={() => handlePause(resource.id)} disabled={pausing}>
          {pausing ? "Pausing…" : "Pause resource"}
        </button>
      </div>
    </div>
  );
}
