"use client";

import type { ResourceResult } from "@/lib/types";
import { formatCurrency, formatPercent, formatRelativeTime } from "@/lib/format";
import { useResources } from "@/contexts/ResourcesContext";

interface AnomalyPanelProps {
  resource: ResourceResult;
}

export default function AnomalyPanel({ resource }: AnomalyPanelProps) {
  const { handlePause, pausingId } = useResources();
  const { stats } = resource;
  const deviationPct = stats.mean > 0 ? ((stats.latest - stats.mean) / stats.mean) * 100 : 0;
  const severity = resource.verdict === "likely_growth" ? "warning" : "critical";
  const pausing = pausingId === resource.id;

  return (
    <div className={`anomaly-panel anomaly-panel--${severity}`}>
      <div className="anomaly-panel__header">
        <div>
          <div className="anomaly-panel__service">
            {resource.name} <span className="anomaly-panel__provider">· {resource.provider}</span>
          </div>
          <div className="anomaly-panel__meta">
            Detected {resource.flaggedAt ? formatRelativeTime(resource.flaggedAt, Date.now()) : "recently"} · confidence {stats.confidence}
          </div>
        </div>
        <span className={`status-badge status-badge--${severity}`}>
          {severity === "critical" ? "Likely waste" : "Possible growth"}
        </span>
      </div>

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
          <span className="measurement__label">Deviation</span>
          <span className="measurement__value tabular measurement__value--critical">{formatPercent(deviationPct)}</span>
        </div>
        <div className="measurement">
          <span className="measurement__label">Z-score</span>
          <span className="measurement__value tabular">{stats.zScore.toFixed(1)}</span>
        </div>
      </div>

      <div className="anomaly-panel__ai">
        <div className="anomaly-panel__ai-label">
          {resource.aiError ? "AI explanation unavailable" : "Likely cause (AI-generated, unverified)"}
        </div>
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
