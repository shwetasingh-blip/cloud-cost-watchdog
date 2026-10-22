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
  type ServiceDef,
  type CustomServiceInput,
} from "@/lib/mockData";
import { analyzeSpend, estimateRunwayDaysLost } from "@/lib/anomalyDetection";
import { formatCurrency, formatPercent } from "@/lib/format";
import { type LogEvent, type EventType, makeEvent, MAX_EVENTS } from "@/lib/eventLog";

const CONNECTED_KEY = "ccw_connected";
export const TICK_MS = 2500;
const HEARTBEAT_EVERY_N_TICKS = 12; // ~30s at TICK_MS=2500

interface SharedState {
  customServices: ServiceDef[];
  pausedIds: string[];
  events: LogEvent[];
}

// The only thing standing between "it works for me" and "it works for
// everyone": this reads the shared database (through our own API, which
// holds the only credentials) instead of this browser's localStorage.
async function fetchSharedState(): Promise<SharedState> {
  const res = await fetch("/api/state");
  const data = await res.json();
  if (!res.ok || data.error) throw new Error(data.error || "Could not load shared state");
  return { customServices: data.customServices ?? [], pausedIds: data.pausedIds ?? [], events: data.events ?? [] };
}

function toResourceResult(service: ServiceDef, isCustom: boolean, pausedIds: Set<string>): ResourceResult {
  const dailySpend = initialDailySpend(service);
  const stats = analyzeSpend(dailySpend);
  if (pausedIds.has(service.id)) {
    const flat = stats.mean;
    const flatSpend = [...dailySpend.slice(0, -1), flat];
    return {
      id: service.id,
      name: service.name,
      provider: service.provider,
      category: service.category,
      unit: service.unit,
      costPerUnit: service.costPerUnit,
      contextNote: service.contextNote,
      dailySpend: flatSpend,
      stats: analyzeSpend(flatSpend),
      paused: true,
      isCustom,
    };
  }
  return {
    id: service.id,
    name: service.name,
    provider: service.provider,
    category: service.category,
    unit: service.unit,
    costPerUnit: service.costPerUnit,
    contextNote: service.contextNote,
    dailySpend,
    stats,
    paused: false,
    isCustom,
  };
}

function buildInitialResources(customCatalog: ServiceDef[], pausedIds: string[]): ResourceResult[] {
  const paused = new Set(pausedIds);
  return [
    ...SERVICE_CATALOG.map((s) => toResourceResult(s, false, paused)),
    ...customCatalog.map((s) => toResourceResult(s, true, paused)),
  ];
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
  handleAddService: (input: CustomServiceInput) => void;
  handleRemoveService: (id: string) => void;
}

const ResourcesContext = createContext<ResourcesContextValue | null>(null);

export function ResourcesProvider({ children }: { children: ReactNode }) {
  const [connected, setConnected] = useState<boolean | null>(null);
  const [resources, setResources] = useState<ResourceResult[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [pausingId, setPausingId] = useState<string | null>(null);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);
  const [checksRun, setChecksRun] = useState(0);
  const [events, setEvents] = useState<LogEvent[]>([]);
  const [customCatalog, setCustomCatalog] = useState<ServiceDef[]>([]);
  const rampTargets = useRef<Record<string, number>>({});
  const ticksRef = useRef(0);
  const customCatalogRef = useRef<ServiceDef[]>([]);

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

  const eventsRef = useRef<LogEvent[]>([]);
  const logEvent = useCallback((type: EventType, message: string) => {
    const next = [makeEvent(type, message), ...eventsRef.current].slice(0, MAX_EVENTS);
    eventsRef.current = next;
    setEvents(next);
    // Fire-and-forget: the UI already updated optimistically above. If this
    // fails, the event simply won't be visible to other sessions — not
    // worth blocking or erroring the interaction that triggered it.
    fetch("/api/events", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ type, message }),
    }).catch(() => {});
  }, []);

  const loadEverything = useCallback(async () => {
    try {
      const shared = await fetchSharedState();
      customCatalogRef.current = shared.customServices;
      setCustomCatalog(shared.customServices);
      eventsRef.current = shared.events;
      setEvents(shared.events);
      const initial = buildInitialResources(shared.customServices, shared.pausedIds);
      resourcesRef.current = initial;
      setResources(initial);
      setLastUpdated(Date.now());
    } catch {
      // Shared backend unreachable — still usable with just the built-in
      // services, so the dashboard isn't blank; flag it honestly instead.
      const initial = buildInitialResources([], []);
      resourcesRef.current = initial;
      setResources(initial);
      setLastUpdated(Date.now());
      setError("Could not reach the shared database — showing built-in services only.");
    }
  }, []);

  useEffect(() => {
    const stored = typeof window !== "undefined" && window.localStorage.getItem(CONNECTED_KEY) === "true";
    setConnected(stored);
    if (stored) loadEverything();
  }, [loadEverything]);

  const handleConnectDone = useCallback(() => {
    try {
      window.localStorage.setItem(CONNECTED_KEY, "true");
    } catch {
      // ignore storage failures, the session still works, just re-asks next visit
    }
    setConnected(true);
    loadEverything().then(() => {
      logEvent("connect", "Connected AWS, OpenAI, Anthropic, Vercel — monitoring started");
    });
  }, [loadEverything, logEvent]);

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
      const resource = resourcesRef.current.find((r) => r.id === id);
      const name = resource?.name ?? id;
      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: id,
            dailySpend,
            resourceName: resource?.name,
            contextNote: resource?.contextNote,
          }),
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
          body: JSON.stringify({ resourceId: id, resourceName: name }),
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

  const handleAddService = useCallback(
    async (input: CustomServiceInput) => {
      try {
        const res = await fetch("/api/services", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(input),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Could not add platform");
        const def: ServiceDef = data.service;
        customCatalogRef.current = [...customCatalogRef.current, def];
        setCustomCatalog(customCatalogRef.current);
        const resource = toResourceResult(def, true, new Set());
        applyResources((prev) => [...prev, resource]);
        logEvent("service", `Added ${def.name} as a new connected service`);
      } catch {
        setError("Could not add that platform — try again.");
      }
    },
    [applyResources, logEvent]
  );

  const handleRemoveService = useCallback(
    async (id: string) => {
      const def = customCatalogRef.current.find((d) => d.id === id);
      if (!def) return; // only user-added platforms can be removed
      try {
        const res = await fetch("/api/services", {
          method: "DELETE",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ id }),
        });
        const data = await res.json();
        if (!res.ok || data.error) throw new Error(data.error || "Could not remove platform");
        delete rampTargets.current[id];
        customCatalogRef.current = customCatalogRef.current.filter((d) => d.id !== id);
        setCustomCatalog(customCatalogRef.current);
        applyResources((prev) => prev.filter((r) => r.id !== id));
        logEvent("service", `Removed ${def.name} from connected services`);
      } catch {
        setError("Could not remove that platform — try again.");
      }
    },
    [applyResources, logEvent]
  );

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
    handleAddService,
    handleRemoveService,
  };

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
}

export function useResources(): ResourcesContextValue {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error("useResources must be used within ResourcesProvider");
  return ctx;
}
