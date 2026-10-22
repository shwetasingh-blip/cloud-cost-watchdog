"use client";

import { useMemo } from "react";
import PageShell from "@/components/dashboard/PageShell";
import AnomalyPanel from "@/components/dashboard/AnomalyPanel";
import ActivityLog from "@/components/dashboard/ActivityLog";
import { useResources } from "@/contexts/ResourcesContext";
import { CheckIcon } from "@/components/icons";

export default function AnomaliesPage() {
  const { flagged, events } = useResources();
  const resolvedEvents = useMemo(() => events.filter((e) => e.type === "pause"), [events]);

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
          <h2 className="panel__title">Recently resolved</h2>
          <span className="panel__meta">{resolvedEvents.length} · persists across reloads</span>
        </div>

        {resolvedEvents.length === 0 ? (
          <div className="empty-state">
            <p className="empty-state__body">Nothing paused yet.</p>
          </div>
        ) : (
          <ActivityLog events={resolvedEvents} limit={10} />
        )}
      </section>
    </PageShell>
  );
}
