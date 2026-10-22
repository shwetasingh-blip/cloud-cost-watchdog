interface SpendChartProps {
  data: number[];
  variant?: "neutral" | "alert" | "growth" | "paused";
  gradientId: string;
}

const COLORS: Record<NonNullable<SpendChartProps["variant"]>, string> = {
  neutral: "#8e8e93",
  alert: "#ff3b30",
  growth: "#ff9500",
  paused: "#34c759",
};

// A small, hand-rolled sparkline with a soft gradient fill underneath,
// styled after the mini-charts in Apple's Stocks / Health apps.
export default function SpendChart({ data, variant = "neutral", gradientId }: SpendChartProps) {
  const width = 180;
  const height = 56;
  const pad = 6;

  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const toXY = (v: number, i: number): [number, number] => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  };

  const points = data.map(toXY);
  const lineStr = points.map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`).join(" ");
  const areaStr = `${pad},${height - pad} ${lineStr} ${width - pad},${height - pad}`;
  const stroke = COLORS[variant];

  return (
    <svg
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
      className="spend-chart"
      role="img"
      aria-label="Daily spend trend, last 14 days"
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={stroke} stopOpacity="0.22" />
          <stop offset="100%" stopColor={stroke} stopOpacity="0" />
        </linearGradient>
      </defs>
      <polygon points={areaStr} fill={`url(#${gradientId})`} stroke="none" />
      <polyline
        points={lineStr}
        fill="none"
        stroke={stroke}
        strokeWidth={2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
