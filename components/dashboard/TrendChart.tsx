"use client";

import { useMemo, useState } from "react";
import type { ResourceResult } from "@/lib/types";
import { formatCurrency } from "@/lib/format";

interface TrendChartProps {
  resources: ResourceResult[];
  height?: number;
}

const WIDTH = 760;
const MARGIN = { top: 16, right: 16, bottom: 30, left: 60 };

function dayLabel(idx: number, lastIdx: number): string {
  if (idx === lastIdx) return "Today";
  const daysAgo = lastIdx - idx;
  if (daysAgo === 1) return "Yesterday";
  return `${daysAgo}d ago`;
}

export default function TrendChart({ resources, height = 300 }: TrendChartProps) {
  const [hoverIdx, setHoverIdx] = useState<number | null>(null);

  const { days, aiSeries, infraSeries, totalSeries, maxTotal } = useMemo(() => {
    const dayCount = resources[0]?.dailySpend.length ?? 0;
    const aiSeries: number[] = [];
    const infraSeries: number[] = [];
    for (let d = 0; d < dayCount; d++) {
      let ai = 0;
      let infra = 0;
      for (const r of resources) {
        const v = r.dailySpend[d] ?? 0;
        if (r.category === "ai") ai += v;
        else infra += v;
      }
      aiSeries.push(ai);
      infraSeries.push(infra);
    }
    const totalSeries = aiSeries.map((v, i) => v + infraSeries[i]);
    const maxTotal = Math.max(...totalSeries, 1);
    return { days: Array.from({ length: dayCount }, (_, i) => i), aiSeries, infraSeries, totalSeries, maxTotal };
  }, [resources]);

  if (days.length === 0) {
    return <div className="trend-chart__empty">No spend data available yet.</div>;
  }

  const plotW = WIDTH - MARGIN.left - MARGIN.right;
  const plotH = height - MARGIN.top - MARGIN.bottom;
  const lastIdx = days.length - 1;
  const niceMax = Math.ceil(maxTotal / 500) * 500 || 500;

  const x = (idx: number) => MARGIN.left + (idx / lastIdx) * plotW;
  const y = (value: number) => MARGIN.top + plotH - (value / niceMax) * plotH;

  const infraPath =
    `M${x(0)},${y(0)} ` + infraSeries.map((v, i) => `L${x(i)},${y(v)}`).join(" ") + ` L${x(lastIdx)},${y(0)} Z`;

  const stackedAiTop = aiSeries.map((v, i) => v + infraSeries[i]);
  const aiAreaPath =
    `M${x(0)},${y(infraSeries[0])} ` +
    stackedAiTop.map((v, i) => `L${x(i)},${y(v)}`).join(" ") +
    ` L${x(lastIdx)},${y(infraSeries[lastIdx])} ` +
    [...infraSeries].reverse().map((v, i) => `L${x(lastIdx - i)},${y(v)}`).join(" ") +
    " Z";

  const yTicks = [0, 0.25, 0.5, 0.75, 1].map((f) => niceMax * f);

  const handleMove: React.MouseEventHandler<SVGRectElement> = (e) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const px = e.clientX - rect.left;
    const ratio = Math.min(1, Math.max(0, px / rect.width));
    const idx = Math.round(ratio * lastIdx);
    setHoverIdx(idx);
  };

  const hover = hoverIdx !== null ? hoverIdx : null;
  const tooltipLeft = hover !== null ? (x(hover) / WIDTH) * 100 : 0;
  const tooltipAlignEnd = hover !== null && hover > lastIdx * 0.65;

  return (
    <div className="trend-chart">
      <div className="trend-chart__legend">
        <span className="legend-item">
          <span className="legend-item__swatch legend-item__swatch--ai" /> AI / LLM providers
        </span>
        <span className="legend-item">
          <span className="legend-item__swatch legend-item__swatch--infra" /> Infrastructure
        </span>
      </div>

      <div className="trend-chart__svg-wrap">
        <svg viewBox={`0 0 ${WIDTH} ${height}`} className="trend-chart__svg" role="img" aria-label="Daily spend, last 14 days, split by AI and infrastructure">
          {yTicks.map((t) => (
            <g key={t}>
              <line x1={MARGIN.left} x2={WIDTH - MARGIN.right} y1={y(t)} y2={y(t)} className="trend-chart__gridline" />
              <text x={MARGIN.left - 10} y={y(t) + 4} textAnchor="end" className="trend-chart__axis-label">
                {formatCurrency(t)}
              </text>
            </g>
          ))}

          <path d={infraPath} className="trend-chart__area trend-chart__area--infra" />
          <path d={aiAreaPath} className="trend-chart__area trend-chart__area--ai" />

          {days.map((d, i) =>
            i % Math.ceil(days.length / 6) === 0 || i === lastIdx ? (
              <text key={d} x={x(i)} y={height - 8} textAnchor="middle" className="trend-chart__axis-label">
                {dayLabel(i, lastIdx)}
              </text>
            ) : null
          )}

          {hover !== null && (
            <line x1={x(hover)} x2={x(hover)} y1={MARGIN.top} y2={MARGIN.top + plotH} className="trend-chart__hover-line" />
          )}

          <rect
            x={MARGIN.left}
            y={MARGIN.top}
            width={plotW}
            height={plotH}
            fill="transparent"
            onMouseMove={handleMove}
            onMouseLeave={() => setHoverIdx(null)}
          />
        </svg>

        {hover !== null && (
          <div
            className="trend-chart__tooltip"
            style={{ left: `${tooltipLeft}%`, ...(tooltipAlignEnd ? { transform: "translateX(-100%)" } : {}) }}
          >
            <div className="trend-chart__tooltip-title">{dayLabel(hover, lastIdx)}</div>
            <div className="trend-chart__tooltip-row">
              <span className="legend-item__swatch legend-item__swatch--ai" /> AI / LLM
              <strong>{formatCurrency(aiSeries[hover])}</strong>
            </div>
            <div className="trend-chart__tooltip-row">
              <span className="legend-item__swatch legend-item__swatch--infra" /> Infrastructure
              <strong>{formatCurrency(infraSeries[hover])}</strong>
            </div>
            <div className="trend-chart__tooltip-row trend-chart__tooltip-row--total">
              Total
              <strong>{formatCurrency(totalSeries[hover])}</strong>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
