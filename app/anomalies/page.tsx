"use client";

import PageShell from "@/components/dashboard/PageShell";
import AnomalyPanel from "@/components/dashboard/AnomalyPanel";
import { useResources } from "@/contexts/ResourcesContext";
import { formatCurrency } from "@/lib/format";
import { CheckIcon } from "@/components/icons";

export default function AnomaliesPage() {
  const { flagged, resolved } = useResources();

  return (
    <PageShell title="Anomalies" subtitle="Spend outside each service's own normal range">
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Active</h2>
          <span className="panel__meta">{flagged.length} right now</span>
        </div>

        {flagged.length === 0 ? (
          <div className="empty-state">
            <CheckIcon size={20} className="empty-state__icon" />
            <p className="empty-state__title">No active anomalies</p>
            <p className="empty-state__body">All connected services are within their normal range.</p>
          </div>
        ) : (
          <div className="anomaly-stack">
            {flagged.map((r) => (
              <AnomalyPanel key={r.id} resource={r} />
            ))}
          </div>
        )}
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Resolved this session</h2>
          <span className="panel__meta">{resolved.length}</span>
        </div>

        {resolved.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__body">Nothing paused yet this session.</p>
          </div>
        ) : (
          <div className="resolved-list">
            {resolved.map((r) => (
              <div className="resolved-row" key={r.id}>
                <span className="status-badge status-badge--good">Paused</span>
                <span className="resolved-row__name">{r.name}</span>
                <span className="resolved-row__detail">
                  Flattened to {formatCurrency(r.stats.mean)} / day
                </span>
              </div>
            ))}
          </div>
        )}
      </section>
    </PageShell>
  );
}
