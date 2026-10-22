interface SpendChartProps {
  data: number[];
  variant?: "neutral" | "alert" | "growth" | "paused";
  width?: number;
  height?: number;
}

const COLORS: Record<NonNullable<SpendChartProps["variant"]>, string> = {
  neutral: "#9AA0B4",
  alert: "#FB7185",
  growth: "#FBBF24",
  paused: "#5EEAD4",
};

// A small, restrained sparkline — line only, no fill or gradient, in
// line with a data-table's quieter visual register.
export default function SpendChart({ data, variant = "neutral", width = 96, height = 28 }: SpendChartProps) {
  const pad = 3;

  if (data.length < 2) return null;

  const max = Math.max(...data);
  const min = Math.min(...data);
  const range = max - min || 1;

  const toXY = (v: number, i: number): [number, number] => {
    const x = pad + (i / (data.length - 1)) * (width - pad * 2);
    const y = height - pad - ((v - min) / range) * (height - pad * 2);
    return [x, y];
  };

  const lineStr = data
    .map(toXY)
    .map(([x, y]) => `${x.toFixed(1)},${y.toFixed(1)}`)
    .join(" ");
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
      <polyline points={lineStr} fill="none" stroke={stroke} strokeWidth={1.5} strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}
