"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import ResourceCard from "@/components/ResourceCard";
import HeroStatus from "@/components/HeroStatus";
import type { ResourceResult } from "@/lib/types";
import { COMPANY_MONTHLY_BURN, type Scenario } from "@/lib/mockData";
import { estimateRunwayDaysLost } from "@/lib/anomalyDetection";

export default function Page() {
  const [scenario, setScenario] = useState<Scenario>("spike");
  const [resources, setResources] = useState<ResourceResult[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);

  const load = useCallback(async (s: Scenario) => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/anomalies?scenario=${s}`);
      const data = await res.json();
      if (!res.ok || data.error) {
        throw new Error(data.error || "Request failed");
      }
      setResources(data.resources);
    } catch {
      setError("Couldn't load spend data.");
      setResources(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load(scenario);
  }, [scenario, load]);

  const handlePause = async (id: string) => {
    setPausingId(id);
    try {
      const res = await fetch("/api/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: id, scenario }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) {
        throw new Error(data.error || "Pause failed");
      }
      setResources((prev) =>
        prev
          ? prev.map((r) => {
              if (r.id !== id) return r;
              const flatValue = r.stats.mean;
              const newSpend = [...r.dailySpend.slice(1), flatValue, flatValue, flatValue];
              return { ...r, paused: true, dailySpend: newSpend };
            })
          : prev
      );
    } catch {
      setError("Could not pause that resource — try again.");
    } finally {
      setPausingId(null);
    }
  };

  const flagged = useMemo(() => resources?.filter((r) => r.stats.flagged && !r.paused) ?? [], [resources]);

  const totalExtraSpend = useMemo(
    () => flagged.reduce((sum, r) => sum + Math.max(0, r.stats.latest - r.stats.mean), 0),
    [flagged]
  );

  const runwayDaysAtRisk = useMemo(
    () => estimateRunwayDaysLost(totalExtraSpend, COMPANY_MONTHLY_BURN),
    [totalExtraSpend]
  );

  return (
    <main className="page">
      <header className="page__header">
        <div className="brand">
          <div>
            <h1>Cloud Cost Watchdog</h1>
            <p className="brand__tagline">Catches spend spikes before they burn your runway</p>
          </div>
        </div>
        <div className="segmented">
          <button
            className={scenario === "spike" ? "segmented__option segmented__option--active" : "segmented__option"}
            onClick={() => setScenario("spike")}
          >
            Spike demo
          </button>
          <button
            className={scenario === "calm" ? "segmented__option segmented__option--active" : "segmented__option"}
            onClick={() => setScenario("calm")}
          >
            Calm demo
          </button>
        </div>
      </header>

      {loading && (
        <>
          <p className="skeleton__label">Checking your spend for anything unusual…</p>
          <div className="skeleton__hero" />
          <div className="skeleton__card" />
          <div className="skeleton__card" />
          <div className="skeleton__card" />
        </>
      )}

      {error && <p className="status status--error">{error}</p>}

      {!loading && !error && resources && resources.length === 0 && <p className="status">No data loaded.</p>}

      {!loading && !error && resources && resources.length > 0 && (
        <>
          <HeroStatus
            flaggedCount={flagged.length}
            totalExtraSpend={totalExtraSpend}
            runwayDaysAtRisk={runwayDaysAtRisk}
          />
          <section>
            <h2 className="resources__label">Resources</h2>
            <div className="resources__list">
              {resources.map((r) => (
                <ResourceCard key={r.id} resource={r} onPause={handlePause} pausing={pausingId === r.id} />
              ))}
            </div>
          </section>
        </>
      )}
    </main>
  );
}
