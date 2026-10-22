"use client";

import SpendChart from "@/components/SpendChart";
import type { ResourceResult } from "@/lib/types";
import { formatCurrency, formatTokens } from "@/lib/format";
import { PauseGlyph, TrashIcon } from "@/components/icons";
import { useResources } from "@/contexts/ResourcesContext";

interface ServiceTableProps {
  resources: ResourceResult[];
}

function StatusBadge({ resource }: { resource: ResourceResult }) {
  if (resource.paused) return <span className="status-badge status-badge--good">Paused</span>;
  if (resource.stats.flagged)
    return (
      <span className={resource.verdict === "likely_growth" ? "status-badge status-badge--warning" : "status-badge status-badge--critical"}>
        Anomaly
      </span>
    );
  return <span className="status-badge status-badge--neutral">Normal</span>;
}

export default function ServiceTable({ resources }: ServiceTableProps) {
  const { handlePause, pausingId, handleRemoveService } = useResources();

  if (resources.length === 0) {
    return <div className="table-empty">No connected services yet.</div>;
  }

  return (
    <div className="service-table-wrap">
      <table className="service-table">
        <thead>
          <tr>
            <th>Service</th>
            <th>Provider</th>
            <th className="num">Current spend</th>
            <th className="num">Usage</th>
            <th>Trend</th>
            <th>Status</th>
            <th>Action</th>
          </tr>
        </thead>
        <tbody>
          {resources.map((r) => {
            const latest = r.dailySpend[r.dailySpend.length - 1];
            const tokensToday = r.unit === "tokens" && r.costPerUnit ? latest / r.costPerUnit : null;
            let variant: "neutral" | "alert" | "growth" | "paused" = "neutral";
            if (r.paused) variant = "paused";
            else if (r.stats.flagged && r.verdict === "likely_growth") variant = "growth";
            else if (r.stats.flagged) variant = "alert";

            const actionable = r.stats.flagged && !r.paused;

            return (
              <tr key={r.id} className={r.stats.flagged && !r.paused ? "service-table__row--flagged" : ""}>
                <td>
                  <span className="service-table__name">{r.name}</span>
                </td>
                <td>
                  <span className="provider-chip">{r.provider.slice(0, 1)}</span>
                  <span className="service-table__provider-name">{r.provider}</span>
                </td>
                <td className="num tabular">{formatCurrency(latest)}</td>
                <td className="num tabular">{tokensToday !== null ? formatTokens(tokensToday) : "—"}</td>
                <td>
                  <SpendChart data={r.dailySpend} variant={variant} width={72} height={24} />
                </td>
                <td>
                  <StatusBadge resource={r} />
                </td>
                <td>
                  {actionable ? (
                    <button
                      className="btn-table-pause"
                      onClick={() => handlePause(r.id)}
                      disabled={pausingId === r.id}
                    >
                      <PauseGlyph size={12} />
                      {pausingId === r.id ? "Pausing…" : "Pause"}
                    </button>
                  ) : r.isCustom ? (
                    <button className="btn-table-remove" onClick={() => handleRemoveService(r.id)}>
                      <TrashIcon size={12} />
                      Remove
                    </button>
                  ) : (
                    <span className="service-table__dash">—</span>
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
