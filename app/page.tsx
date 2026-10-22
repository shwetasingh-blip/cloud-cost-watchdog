"use client";

import PageShell from "@/components/dashboard/PageShell";
import KpiRow from "@/components/dashboard/KpiRow";
import TrendChart from "@/components/dashboard/TrendChart";
import SpendBreakdown from "@/components/dashboard/SpendBreakdown";
import ServiceTable from "@/components/dashboard/ServiceTable";
import AnomalyPanel from "@/components/dashboard/AnomalyPanel";
import ActivityLog from "@/components/dashboard/ActivityLog";
import ChatBox from "@/components/dashboard/ChatBox";
import { useResources } from "@/contexts/ResourcesContext";

export default function OverviewPage() {
  const { resources, flagged, totalSpendToday, spendDeltaPct, aiSpendToday, error, events } = useResources();

  return (
    <PageShell title="Overview" subtitle="Everything you're spending, in one place">
      {error && <p className="banner banner--critical">{error}</p>}

      <KpiRow
        totalSpendToday={totalSpendToday}
        spendDeltaPct={spendDeltaPct}
        flaggedCount={flagged.length}
        connectedCount={resources.length}
        aiSpendToday={aiSpendToday}
        resources={resources}
      />

      <ChatBox />

      {flagged.length > 0 && (
        <section className="panel">
          <div className="panel__head">
            <h2 className="panel__title">Needs your attention</h2>
          </div>
          <div className="anomaly-stack">
            {flagged.map((r) => (
              <AnomalyPanel key={r.id} resource={r} />
            ))}
          </div>
        </section>
      )}

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Spend trend</h2>
          <span className="panel__meta">Last 14 days</span>
        </div>
        {resources.length > 0 ? <TrendChart resources={resources} /> : <div className="table-empty">No data yet.</div>}
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Spend by service</h2>
          <span className="panel__meta">Today</span>
        </div>
        <SpendBreakdown resources={resources} />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Service status</h2>
          <span className="panel__meta">{resources.length} connected</span>
        </div>
        <ServiceTable resources={resources} />
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Activity</h2>
          <span className="panel__meta">Most recent</span>
        </div>
        <ActivityLog events={events} limit={8} />
      </section>
    </PageShell>
  );
}
