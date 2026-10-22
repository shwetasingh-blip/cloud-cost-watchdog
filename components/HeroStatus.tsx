interface HeroStatusProps {
  flaggedCount: number;
  totalExtraSpend: number;
  runwayDaysAtRisk: number;
}

function AlertIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#FF3B30" />
      <rect x="18" y="10" width="4" height="14" rx="2" fill="white" />
      <circle cx="20" cy="28" r="2.3" fill="white" />
    </svg>
  );
}

function ClearIcon() {
  return (
    <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
      <circle cx="20" cy="20" r="20" fill="#34C759" />
      <path
        d="M12 20.5L17 25.5L28 14.5"
        stroke="white"
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        fill="none"
      />
    </svg>
  );
}

// The one headline on the page: answers "is anything wrong, right now"
// in plain English before anyone has to read a single chart.
export default function HeroStatus({ flaggedCount, totalExtraSpend, runwayDaysAtRisk }: HeroStatusProps) {
  const isAlert = flaggedCount > 0;

  return (
    <div className="hero">
      <div className="hero__icon">{isAlert ? <AlertIcon /> : <ClearIcon />}</div>
      <div className="hero__body">
        {isAlert ? (
          <>
            <div className="hero__number">${totalExtraSpend.toFixed(0)}</div>
            <p className="hero__label">
              {flaggedCount === 1
                ? "More than usual on 1 resource today."
                : `More than usual across ${flaggedCount} resources today.`}{" "}
              That&apos;s about {runwayDaysAtRisk} day{runwayDaysAtRisk === 1 ? "" : "s"} of runway if it
              continues.
            </p>
          </>
        ) : (
          <>
            <div className="hero__number hero__number--clear">You&apos;re all clear</div>
            <p className="hero__label">No unusual spend detected across your connected resources.</p>
          </>
        )}
      </div>
    </div>
  );
}
