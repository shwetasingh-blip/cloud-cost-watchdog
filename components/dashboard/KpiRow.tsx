import { formatCurrency, formatPercent } from "@/lib/format";
import type { ResourceResult } from "@/lib/types";

interface KpiRowProps {
  totalSpendToday: number;
  spendDeltaPct: number;
  flaggedCount: number;
  connectedCount: number;
  aiSpendToday: number;
  resources: ResourceResult[];
}

function KpiCard({
  label,
  value,
  caption,
  tone,
  deltaPct,
}: {
  label: string;
  value: string;
  caption: string;
  tone?: "critical" | "good";
  deltaPct?: number;
}) {
  return (
    <div className="kpi-card">
      <span className="kpi-card__label">{label}</span>
      <span className={tone ? `kpi-card__value kpi-card__value--${tone}` : "kpi-card__value"}>{value}</span>
      <span className="kpi-card__caption">
        {caption}
        {typeof deltaPct === "number" && (
          <span className={`delta-pill ${deltaPct > 0 ? "delta-pill--bad" : "delta-pill--good"}`}>
            {formatPercent(deltaPct)}
          </span>
        )}
      </span>
    </div>
  );
}

export default function KpiRow({ totalSpendToday, spendDeltaPct, flaggedCount, connectedCount, aiSpendToday, resources }: KpiRowProps) {
  const providerNames = Array.from(new Set(resources.map((r) => r.provider))).join(", ");

  return (
    <div className="kpi-grid">
      <KpiCard
        label="Total monitored spend"
        value={formatCurrency(totalSpendToday)}
        caption="Today vs 13-day avg"
        deltaPct={spendDeltaPct}
      />
      <KpiCard
        label="Active anomalies"
        value={String(flaggedCount)}
        caption={flaggedCount > 0 ? "Needs attention, right now" : "All clear, right now"}
        tone={flaggedCount > 0 ? "critical" : "good"}
      />
      <KpiCard label="Connected services" value={String(connectedCount)} caption={providerNames || "No services"} />
      <KpiCard label="AI API spending" value={formatCurrency(aiSpendToday)} caption="Today · OpenAI + Anthropic" />
    </div>
  );
}
