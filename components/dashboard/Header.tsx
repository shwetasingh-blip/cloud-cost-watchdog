"use client";

import { useEffect, useState } from "react";
import { MenuIcon, RefreshIcon, ZapIcon } from "@/components/icons";
import { useResources, TICK_MS } from "@/contexts/ResourcesContext";
import { formatRelativeTime } from "@/lib/format";

interface HeaderProps {
  title: string;
  subtitle?: string;
  onMenuClick: () => void;
}

export default function Header({ title, subtitle, onMenuClick }: HeaderProps) {
  const { connected, lastUpdated, showSimulateButton, handleSimulateSpike, refreshNow, flagged } = useResources();
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const nextCheckInSec = lastUpdated ? Math.max(0, Math.ceil((lastUpdated + TICK_MS - now) / 1000)) : null;

  return (
    <header className="dash-header">
      <div className="dash-header__left">
        <button className="dash-header__menu" onClick={onMenuClick} aria-label="Open navigation">
          <MenuIcon size={18} />
        </button>
        <div>
          <h1 className="dash-header__title">{title}</h1>
          {subtitle && <p className="dash-header__subtitle">{subtitle}</p>}
        </div>
      </div>

      <div className="dash-header__right">
        <div className={flagged.length > 0 ? "status-chip status-chip--critical" : "status-chip status-chip--good"}>
          <span className="status-chip__dot" aria-hidden="true" />
          {flagged.length > 0 ? `${flagged.length} anomaly` : "All systems normal"}
        </div>

        {connected && lastUpdated && (
          <span className="dash-header__updated">
            Updated {formatRelativeTime(lastUpdated, now)}
            {nextCheckInSec !== null && ` · next in ${nextCheckInSec}s`}
          </span>
        )}

        <button className="icon-btn" onClick={refreshNow} aria-label="Refresh now" title="Refresh now">
          <RefreshIcon size={15} />
        </button>

        {showSimulateButton && (
          <button className="btn-simulate" onClick={handleSimulateSpike}>
            <ZapIcon size={13} />
            Simulate spike
            <span className="btn-simulate__tag">Demo</span>
          </button>
        )}
      </div>
    </header>
  );
}
