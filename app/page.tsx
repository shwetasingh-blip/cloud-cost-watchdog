"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import ResourceCard from "@/components/ResourceCard";
import HeroStatus from "@/components/HeroStatus";
import ConnectAccounts from "@/components/ConnectAccounts";
import type { ResourceResult } from "@/lib/types";
import {
  SERVICE_CATALOG,
  COMPANY_MONTHLY_BURN,
  CATEGORY_LABELS,
  SPIKE_TARGET_ID,
  SPIKE_TARGET_VALUE,
  initialDailySpend,
  tickLiveSpend,
  stepToward,
  type Category,
} from "@/lib/mockData";
import { analyzeSpend, estimateRunwayDaysLost } from "@/lib/anomalyDetection";

const CONNECTED_KEY = "ccw_connected";
const TICK_MS = 2500;

function buildInitialResources(): ResourceResult[] {
  return SERVICE_CATALOG.map((service) => {
    const dailySpend = initialDailySpend(service);
    return {
      id: service.id,
      name: service.name,
      category: service.category,
      unit: service.unit,
      costPerUnit: service.costPerUnit,
      dailySpend,
      stats: analyzeSpend(dailySpend),
      paused: false,
    };
  });
}

export default function Page() {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [resources, setResources] = useState<ResourceResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const rampTargets = useRef<Record<string, number>>({});

  // The live loop mutates state many times a second across async
  // boundaries (fetch responses, interval ticks). Routing every change
  // through this ref keeps a single, always-current source of truth and
  // guarantees each updater function runs exactly once — React's dev
  // mode is allowed to invoke a setState updater function twice to catch
  // impure ones, which would otherwise double-fire the AI explain call.
  const resourcesRef = useRef<ResourceResult[]>([]);
  const applyResources = useCallback((updater: (prev: ResourceResult[]) => ResourceResult[]) => {
    const next = updater(resourcesRef.current);
    resourcesRef.current = next;
    setResources(next);
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" && window.localStorage.getItem(CONNECTED_KEY) === "true";
    setConnected(stored);
    if (stored) {
      const initial = buildInitialResources();
      resourcesRef.current = initial;
      setResources(initial);
    }
  }, []);

  const handleConnectDone = () => {
    try {
      window.localStorage.setItem(CONNECTED_KEY, "true");
    } catch {
      // ignore storage failures, the session still works, just re-asks next visit
    }
    const initial = buildInitialResources();
    resourcesRef.current = initial;
    setResources(initial);
    setConnected(true);
  };

  const requestExplanation = useCallback(
    async (id: string, dailySpend: number[]) => {
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ resourceId: id, dailySpend }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Explain failed");
        applyResources((prev) =>
          prev.map((r) =>
            r.id === id
              ? { ...r, stats: data.stats, explanation: data.explanation, verdict: data.verdict, aiError: data.aiError, explaining: false }
              : r
          )
        );
      } catch {
        applyResources((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  explaining: false,
                  aiError: true,
                  explanation: "AI explanation unavailable — showing raw signal only.",
                  verdict: "unclear",
                }
              : r
          )
        );
      }
    },
    [applyResources]
  );

  // The live loop: every tick, nudge every active resource's spend (or
  // step a ramping one toward its target), recompute its stats in plain
  // code, and kick off an AI explanation the moment one crosses the
  // anomaly threshold for the first time, once it has fully arrived.
  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(() => {
      const toExplain: { id: string; dailySpend: number[] }[] = [];

      applyResources((prev) =>
        prev.map((r) => {
          if (r.paused || r.explaining) return r;

          const isRamping = rampTargets.current[r.id] !== undefined;

          if (!isRamping && r.stats.flagged && r.explanation) return r;

          let newDailySpend: number[];
          let justArrived = false;
          if (isRamping) {
            const target = rampTargets.current[r.id];
            const last = r.dailySpend[r.dailySpend.length - 1];
            const { value, arrived } = stepToward(last, target);
            if (arrived) {
              delete rampTargets.current[r.id];
              justArrived = true;
            }
            newDailySpend = [...r.dailySpend.slice(0, -1), value];
          } else {
            newDailySpend = tickLiveSpend(r.dailySpend);
          }

          const stats = analyzeSpend(newDailySpend);
          const eligibleForExplain = isRamping ? justArrived : true;
          const newlyFlagged = eligibleForExplain && stats.flagged && !r.explanation;

          if (newlyFlagged) toExplain.push({ id: r.id, dailySpend: newDailySpend });

          return { ...r, dailySpend: newDailySpend, stats, explaining: newlyFlagged };
        })
      );

      toExplain.forEach(({ id, dailySpend }) => requestExplanation(id, dailySpend));
    }, TICK_MS);

    return () => clearInterval(interval);
  }, [connected, requestExplanation, applyResources]);

  const handlePause = async (id: string) => {
    setPausingId(id);
    delete rampTargets.current[id];
    try {
      const res = await fetch("/api/pause", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ resourceId: id }),
      });
      const data = await res.json();
      if (!res.ok || !data.success) throw new Error(data.error || "Pause failed");
      applyResources((prev) =>
        prev.map((r) => {
          if (r.id !== id) return r;
          const flat = r.stats.mean;
          return { ...r, paused: true, dailySpend: [...r.dailySpend.slice(1), flat, flat, flat] };
        })
      );
    } catch {
      setError("Could not pause that resource — try again.");
    } finally {
      setPausingId(null);
    }
  };

  const handleSimulateSpike = () => {
    rampTargets.current[SPIKE_TARGET_ID] = SPIKE_TARGET_VALUE;
  };

  const flagged = useMemo(() => resources.filter((r) => r.stats.flagged && !r.paused), [resources]);
  const totalExtraSpend = useMemo(
    () => flagged.reduce((sum, r) => sum + Math.max(0, r.stats.latest - r.stats.mean), 0),
    [flagged]
  );
  const runwayDaysAtRisk = useMemo(
    () => estimateRunwayDaysLost(totalExtraSpend, COMPANY_MONTHLY_BURN),
    [totalExtraSpend]
  );

  const grouped = useMemo(() => {
    const order: Category[] = ["ai", "cloud", "other"];
    return order
      .map((cat) => ({ category: cat, items: resources.filter((r) => r.category === cat) }))
      .filter((g) => g.items.length > 0);
  }, [resources]);

  const spikeTarget = resources.find((r) => r.id === SPIKE_TARGET_ID);
  const showSimulateButton = spikeTarget && !spikeTarget.paused && !spikeTarget.stats.flagged;

  if (connected === null) return null; // avoid a flash before localStorage is read

  if (!connected) {
    return <ConnectAccounts onDone={handleConnectDone} />;
  }

  return (
    <main className="page">
      <header className="page__header">
        <div className="brand">
          <div>
            <h1>Cloud Cost Watchdog</h1>
            <p className="brand__tagline">
              <span className="live-dot" aria-hidden="true" /> Live &middot; watching 5 connected services
            </p>
          </div>
        </div>
      </header>

      {error && <p className="status status--error">{error}</p>}

      <HeroStatus flaggedCount={flagged.length} totalExtraSpend={totalExtraSpend} runwayDaysAtRisk={runwayDaysAtRisk} />

      {grouped.map((group) => (
        <section key={group.category} className="category-section">
          <h2 className="resources__label">{CATEGORY_LABELS[group.category]}</h2>
          <div className="resources__list">
            {group.items.map((r) => (
              <ResourceCard key={r.id} resource={r} onPause={handlePause} pausing={pausingId === r.id} />
            ))}
          </div>
        </section>
      ))}

      {showSimulateButton && (
        <button className="simulate-btn" onClick={handleSimulateSpike}>
          Simulate a cost spike
        </button>
      )}
    </main>
  );
}
