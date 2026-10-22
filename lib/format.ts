export function formatCurrency(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  });
}

export function formatCurrencyPrecise(value: number): string {
  return value.toLocaleString("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 2,
  });
}

export function formatTokens(tokens: number): string {
  if (tokens >= 1_000_000) return `${(tokens / 1_000_000).toFixed(1)}M tokens`;
  if (tokens >= 1_000) return `${(tokens / 1_000).toFixed(1)}K tokens`;
  return `${Math.round(tokens)} tokens`;
}

export function formatPercent(value: number): string {
  const sign = value > 0 ? "+" : "";
  return `${sign}${value.toFixed(1)}%`;
}

// Plain-English framing of a deviation — no "deviation," no raw stats
// jargon. Switches to "Nx your usual spend" once the jump is large
// enough that a plain percent stops being an intuitive read.
export function formatPlainDeviation(pct: number, reference: string = "your usual spend"): string {
  if (pct >= 100) {
    const multiplier = Math.floor(1 + pct / 100);
    return `more than ${multiplier}x ${reference}`;
  }
  if (pct > 0) return `${pct.toFixed(0)}% above ${reference}`;
  if (pct < 0) return `${Math.abs(pct).toFixed(0)}% below ${reference}`;
  return `right at ${reference}`;
}

export function formatRelativeTime(timestampMs: number, nowMs: number): string {
  const diffSec = Math.max(0, Math.round((nowMs - timestampMs) / 1000));
  if (diffSec < 5) return "just now";
  if (diffSec < 60) return `${diffSec}s ago`;
  const diffMin = Math.round(diffSec / 60);
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  return `${diffHr}h ago`;
}

export function formatClockTime(timestampMs: number): string {
  return new Date(timestampMs).toLocaleTimeString("en-US", {
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  });
}
