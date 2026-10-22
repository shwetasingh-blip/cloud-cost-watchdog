"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import type { ResourceResult } from "@/lib/types";
import {
  SERVICE_CATALOG,
  COMPANY_MONTHLY_BURN,
  SPIKE_TARGET_ID,
  SPIKE_TARGET_VALUE,
  initialDailySpend,
  tickLiveSpend,
  stepToward,
} from "@/lib/mockData";
import { analyzeSpend, estimateRunwayDaysLost } from "@/lib/anomalyDetection";
import { formatCurrency, formatPercent } from "@/lib/format";
import { type LogEvent, type EventType, makeEvent, EVENTS_KEY, MAX_EVENTS } from "@/lib/eventLog";

const CONNECTED_KEY = "ccw_connected";
export const TICK_MS = 2500;
const HEARTBEAT_EVERY_N_TICKS = 12; // ~30s at TICK_MS=2500

function loadPersistedEvents(): LogEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as LogEvent[]) : [];
  } catch {
    return [];
  }
}

function buildInitialResources(): ResourceResult[] {
  return SERVICE_CATALOG.map((service) => {
    const dailySpend = initialDailySpend(service);
    return {
      id: service.id,
      name: service.name,
      provider: service.provider,
      category: service.category,
      unit: service.unit,
      costPerUnit: service.costPerUnit,
      dailySpend,
      stats: analyzeSpend(dailySpend),
      paused: false,
    };
  });
}

interface ResourcesContextValue {
  connected: boolean | null;
  resources: ResourceResult[];
  error: string | null;
  pausingId: string | null;
  lastUpdated: number | null;
  checksRun: number;
  events: LogEvent[];
  flagged: ResourceResult[];
  totalSpendToday: number;
  baselineTotalToday: number;
  spendDeltaPct: number;
  aiSpendToday: number;
  totalExtraSpend: number;
  runwayDaysAtRisk: number;
  spikeTarget: ResourceResult | undefined;
  showSimulateButton: boolean;
  handlePause: (id: string) => void;
  handleSimulateSpike: () => void;
  handleConnectDone: () => void;
  handleDisconnect: () => void;
  refreshNow: () => void;
}

const ResourcesContext = createContext<ResourcesContextValue | null>(null);

export function ResourcesProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [resources, setResources] = useState<ResourceResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [checksRun, setChecksRun] = useState(0);
  // A lazy initializer runs synchronously on the very first render, before
  // any effect (including the write-effect below that persists this same
  // state back to storage). Reading it in a useEffect instead created a
  // real race: on a full reload, React's dev-mode double-mount let the
  // write-effect fire once with the still-default empty array before the
  // read-effect's result ever landed, permanently clobbering saved history
  // with "[]". A pure lazy initializer has no such window.
  const [events, setEvents] = useState<LogEvent[]>(loadPersistedEvents);
  const rampTargets = useRef<Record<string, number>>({});
  const ticksRef = useRef(0);

  // Every change — ticks, explain responses, pauses — routes through these
  // ref-backed helpers so each state transition applies exactly once, even
  // though React's dev mode may invoke an updater function more than once
  // to catch impure ones (which would otherwise double-fire the AI call or
  // double-log an event).
  const resourcesRef = useRef<ResourceResult[]>([]);
  const applyResources = useCallback((updater: (prev: ResourceResult[]) => ResourceResult[]) => {
    const next = updater(resourcesRef.current);
    resourcesRef.current = next;
    setResources(next);
  }, []);

  const eventsRef = useRef<LogEvent[]>(events);
  const logEvent = useCallback((type: EventType, message: string) => {
    const next = [makeEvent(type, message), ...eventsRef.current].slice(0, MAX_EVENTS);
    eventsRef.current = next;
    setEvents(next);
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" && window.localStorage.getItem(CONNECTED_KEY) === "true";
    setConnected(stored);
    if (stored) {
      const initial = buildInitialResources();
      resourcesRef.current = initial;
      setResources(initial);
      setLastUpdated(Date.now());
    }
  }, []);

  useEffect(() => {
    try {
      window.localStorage.setItem(EVENTS_KEY, JSON.stringify(events));
    } catch {
      // ignore storage failures, the log still works for this session
    }
  }, [events]);

  const handleConnectDone = useCallback(() => {
    try {
      window.localStorage.setItem(CONNECTED_KEY, "true");
    } catch {
      // ignore storage failures, the session still works, just re-asks next visit
    }
    const initial = buildInitialResources();
    resourcesRef.current = initial;
    setResources(initial);
    setLastUpdated(Date.now());
    setConnected(true);
    logEvent("connect", "Connected AWS, OpenAI, Anthropic, Vercel — monitoring started");
  }, [logEvent]);

  const handleDisconnect = useCallback(() => {
    try {
      window.localStorage.removeItem(CONNECTED_KEY);
    } catch {
      // ignore
    }
    rampTargets.current = {};
    resourcesRef.current = [];
    setResources([]);
    setLastUpdated(null);
    setConnected(false);
    logEvent("disconnect", "Disconnected all accounts");
  }, [logEvent]);

  const requestExplanation = useCallback(
    async (id: string, dailySpend: number[]) => {
      const name = resourcesRef.current.find((r) => r.id === id)?.name ?? id;
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
        logEvent("explained", data.aiError ? `AI explanation unavailable for ${name}` : `AI explanation ready for ${name}`);
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
        logEvent("explained", `AI explanation unavailable for ${name}`);
      }
    },
    [applyResources, logEvent]
  );

  const tick = useCallback(() => {
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

        if (newlyFlagged) {
          toExplain.push({ id: r.id, dailySpend: newDailySpend });
          const pct = stats.mean > 0 ? ((stats.latest - stats.mean) / stats.mean) * 100 : 0;
          logEvent("anomaly", `${r.name} spend spiked to ${formatCurrency(stats.latest)} (${formatPercent(pct)})`);
        }

        return {
          ...r,
          dailySpend: newDailySpend,
          stats,
          explaining: newlyFlagged,
          flaggedAt: newlyFlagged ? Date.now() : r.flaggedAt,
        };
      })
    );

    ticksRef.current += 1;
    setChecksRun(ticksRef.current);
    setLastUpdated(Date.now());

    if (toExplain.length === 0 && ticksRef.current % HEARTBEAT_EVERY_N_TICKS === 0) {
      logEvent("heartbeat", `Routine check complete — ${resourcesRef.current.length} services normal`);
    }

    toExplain.forEach(({ id, dailySpend }) => requestExplanation(id, dailySpend));
  }, [applyResources, requestExplanation, logEvent]);

  useEffect(() => {
    if (!connected) return;
    const interval = setInterval(tick, TICK_MS);
    return () => clearInterval(interval);
  }, [connected, tick]);

  const handlePause = useCallback(
    async (id: string) => {
      setPausingId(id);
      delete rampTargets.current[id];
      const name = resourcesRef.current.find((r) => r.id === id)?.name ?? id;
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
        logEvent("pause", `Paused ${name} — spend flattened to ${formatCurrency(resourcesRef.current.find((r) => r.id === id)?.stats.mean ?? 0)}/day`);
      } catch {
        setError("Could not pause that resource — try again.");
      } finally {
        setPausingId(null);
      }
    },
    [applyResources, logEvent]
  );

  const handleSimulateSpike = useCallback(() => {
    rampTargets.current[SPIKE_TARGET_ID] = SPIKE_TARGET_VALUE;
  }, []);

  const refreshNow = useCallback(() => {
    tick();
  }, [tick]);

  const flagged = useMemo(() => resources.filter((r) => r.stats.flagged && !r.paused), [resources]);

  const totalSpendToday = useMemo(
    () => resources.reduce((sum, r) => sum + r.dailySpend[r.dailySpend.length - 1], 0),
    [resources]
  );
  const baselineTotalToday = useMemo(
    () => resources.reduce((sum, r) => sum + r.stats.mean, 0),
    [resources]
  );
  const spendDeltaPct = baselineTotalToday > 0 ? ((totalSpendToday - baselineTotalToday) / baselineTotalToday) * 100 : 0;

  const aiSpendToday = useMemo(
    () => resources.filter((r) => r.category === "ai").reduce((sum, r) => sum + r.dailySpend[r.dailySpend.length - 1], 0),
    [resources]
  );

  const totalExtraSpend = useMemo(
    () => flagged.reduce((sum, r) => sum + Math.max(0, r.stats.latest - r.stats.mean), 0),
    [flagged]
  );
  const runwayDaysAtRisk = useMemo(
    () => estimateRunwayDaysLost(totalExtraSpend, COMPANY_MONTHLY_BURN),
    [totalExtraSpend]
  );

  const spikeTarget = resources.find((r) => r.id === SPIKE_TARGET_ID);
  const showSimulateButton = Boolean(spikeTarget && !spikeTarget.paused && !spikeTarget.stats.flagged);

  const value: ResourcesContextValue = {
    connected,
    resources,
    error,
    pausingId,
    lastUpdated,
    checksRun,
    events,
    flagged,
    totalSpendToday,
    baselineTotalToday,
    spendDeltaPct,
    aiSpendToday,
    totalExtraSpend,
    runwayDaysAtRisk,
    spikeTarget,
    showSimulateButton,
    handlePause,
    handleSimulateSpike,
    handleConnectDone,
    handleDisconnect,
    refreshNow,
  };

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
}

export function useResources(): ResourcesContextValue {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error("useResources must be used within ResourcesProvider");
  return ctx;
}
