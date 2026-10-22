import type { ResourceResult } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

interface SpendBreakdownProps {
  resources: ResourceResult[];
}

export default function SpendBreakdown({ resources }: SpendBreakdownProps) {
  const rows = [...resources]
    .map((r) => ({ ...r, value: r.dailySpend[r.dailySpend.length - 1] }))
    .sort((a, b) => b.value - a.value);
  const max = Math.max(...rows.map((r) => r.value), 1);

  return (
    <div className="breakdown">
      {rows.map((r) => (
        <div className="breakdown__row" key={r.id}>
          <div className="breakdown__label">
            <span className="breakdown__name">{r.name}</span>
            <span className="breakdown__provider">{r.provider}</span>
          </div>
          <div className="breakdown__bar-track">
            <div
              className={`breakdown__bar breakdown__bar--${r.category}`}
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </div>
          <span className="breakdown__value">{formatCurrency(r.value)}</span>
        </div>
      ))}
    </div>
  );
}
