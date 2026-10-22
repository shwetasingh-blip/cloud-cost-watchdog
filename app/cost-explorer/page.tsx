"use client";

import PageShell from "@/components/dashboard/PageShell";
import TrendChart from "@/components/dashboard/TrendChart";
import SpendBreakdown from "@/components/dashboard/SpendBreakdown";
import { useResources } from "@/contexts/ResourcesContext";
import { formatCurrency, formatPercent } from "@/lib/format";

export default function CostExplorerPage() {
  const { resources, totalSpendToday, baselineTotalToday, spendDeltaPct, aiSpendToday } = useResources();
  const infraSpendToday = totalSpendToday - aiSpendToday;

  return (
    <PageShell title="Cost Explorer" subtitle="Daily spend, broken down by category and service">
      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Spend trend</h2>
          <span className="panel__meta">Last 14 days · fixed range (no longer history collected yet)</span>
        </div>
        {resources.length > 0 ? <TrendChart resources={resources} height={340} /> : <div className="table-empty">No data yet.</div>}
        <div className="explorer-summary">
          <div className="explorer-summary__item">
            <span className="explorer-summary__label">Today, total</span>
            <span className="explorer-summary__value tabular">{formatCurrency(totalSpendToday)}</span>
          </div>
          <div className="explorer-summary__item">
            <span className="explorer-summary__label">13-day average, total</span>
            <span className="explorer-summary__value tabular">{formatCurrency(baselineTotalToday)}</span>
          </div>
          <div className="explorer-summary__item">
            <span className="explorer-summary__label">Change vs average</span>
            <span className={`explorer-summary__value tabular ${spendDeltaPct > 5 ? "explorer-summary__value--critical" : ""}`}>
              {formatPercent(spendDeltaPct)}
            </span>
          </div>
          <div className="explorer-summary__item">
            <span className="explorer-summary__label">AI vs. infrastructure, today</span>
            <span className="explorer-summary__value tabular">
              {formatCurrency(aiSpendToday)} / {formatCurrency(infraSpendToday)}
            </span>
          </div>
        </div>
      </section>

      <section className="panel">
        <div className="panel__head">
          <h2 className="panel__title">Spend by service</h2>
          <span className="panel__meta">Today, sorted highest to lowest</span>
        </div>
        <SpendBreakdown resources={resources} />
      </section>
    </PageShell>
  );
}
