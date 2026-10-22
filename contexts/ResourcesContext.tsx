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
  createCustomServiceDef,
  type ServiceDef,
  type CustomServiceInput,
} from "@/lib/mockData";
import { analyzeSpend, estimateRunwayDaysLost } from "@/lib/anomalyDetection";
import { formatCurrency, formatPercent } from "@/lib/format";
import { generateQuickRead } from "@/lib/quickRead";
import { type Guardrail, GUARDRAILS_KEY, isGuardrailBreached } from "@/lib/guardrails";
import { type LogEvent, type EventType, makeEvent, EVENTS_KEY, MAX_EVENTS } from "@/lib/eventLog";

const CONNECTED_KEY = "ccw_connected";
const CUSTOM_CATALOG_KEY = "bw_custom_services";
export const TICK_MS = 2500;
const HEARTBEAT_EVERY_N_TICKS = 12; // ~30s at TICK_MS=2500
// Gemini's free tier can take 60s+ to respond. A founder deciding whether
// to pause something shouldn't wait that long to see ANY read on it — so
// a deterministic "quick read" fills in at this mark if the real call
// hasn't landed yet, and the real explanation silently replaces it the
// moment it does.
const QUICK_READ_TIMEOUT_MS = 4500;

function loadPersistedEvents(): LogEvent[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(EVENTS_KEY);
    return raw ? (JSON.parse(raw) as LogEvent[]) : [];
  } catch {
    return [];
  }
}

function loadCustomCatalog(): ServiceDef[] {
  if (typeof window === "undefined") return [];
  try {
    const raw = window.localStorage.getItem(CUSTOM_CATALOG_KEY);
    return raw ? (JSON.parse(raw) as ServiceDef[]) : [];
  } catch {
    return [];
  }
}

function loadGuardrails(): Record<string, Guardrail> {
  if (typeof window === "undefined") return {};
  try {
    const raw = window.localStorage.getItem(GUARDRAILS_KEY);
    return raw ? (JSON.parse(raw) as Record<string, Guardrail>) : {};
  } catch {
    return {};
  }
}

function toResourceResult(service: ServiceDef, isCustom: boolean): ResourceResult {
  const dailySpend = initialDailySpend(service);
  return {
    id: service.id,
    name: service.name,
    provider: service.provider,
    category: service.category,
    unit: service.unit,
    costPerUnit: service.costPerUnit,
    contextNote: service.contextNote,
    dailySpend,
    stats: analyzeSpend(dailySpend),
    paused: false,
    isCustom,
  };
}

function buildInitialResources(customCatalog: ServiceDef[]): ResourceResult[] {
  return [
    ...SERVICE_CATALOG.map((s) => toResourceResult(s, false)),
    ...customCatalog.map((s) => toResourceResult(s, true)),
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
  handleAddService: (input: CustomServiceInput) => string;
  handleRemoveService: (id: string) => void;
  guardrails: Record<string, Guardrail>;
  handleSetGuardrail: (guardrail: Guardrail) => void;
  handleClearGuardrail: (resourceId: string) => void;
  demoSignal: number;
  handleLoadDemo: () => void;
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
  const [customCatalog, setCustomCatalog] = useState<ServiceDef[]>(loadCustomCatalog);
  const [guardrails, setGuardrails] = useState<Record<string, Guardrail>>(loadGuardrails);
  // Bumped each time the presenter loads the demo scenario; ChatBox
  // watches this to fire its own canned question, since chat history
  // lives in that component, not here.
  const [demoSignal, setDemoSignal] = useState(0);
  const rampTargets = useRef<Record<string, number>>({});
  const ticksRef = useRef(0);
  const customCatalogRef = useRef<ServiceDef[]>(customCatalog);
  const guardrailsRef = useRef<Record<string, Guardrail>>(guardrails);

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
      const initial = buildInitialResources(customCatalogRef.current);
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
    const initial = buildInitialResources(customCatalogRef.current);
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
    async (id: string, dailySpend: number[], guardrailThresholdDollars?: number) => {
      const resource = resourcesRef.current.find((r) => r.id === id);
      const name = resource?.name ?? id;

      // If the real AI call hasn't answered by this mark, show an honest,
      // deterministic reading computed from data we already have — never
      // fabricated, clearly labeled as a placeholder (see AnomalyPanel) —
      // so there's always something readable within a few seconds.
      const quickReadTimer = setTimeout(() => {
        const current = resourcesRef.current.find((r) => r.id === id);
        if (!current || current.explanation) return; // real answer already landed
        const extraSpend =
          typeof guardrailThresholdDollars === "number"
            ? Math.max(0, current.stats.latest - guardrailThresholdDollars)
            : Math.max(0, current.stats.latest - current.stats.mean);
        const runwayDaysLost = estimateRunwayDaysLost(extraSpend, COMPANY_MONTHLY_BURN);
        const quickText = generateQuickRead({
          resourceName: current.name,
          stats: current.stats,
          contextNote: current.contextNote,
          runwayDaysLost,
          guardrailThresholdDollars,
        });
        applyResources((prev) =>
          prev.map((r) => (r.id === id && !r.explanation ? { ...r, explanation: quickText, verdict: "unclear", explanationSource: "quick" } : r))
        );
      }, QUICK_READ_TIMEOUT_MS);

      try {
        const res = await fetch("/api/explain", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            resourceId: id,
            dailySpend,
            resourceName: resource?.name,
            contextNote: resource?.contextNote,
            guardrailThresholdDollars,
          }),
        });
        const data = await res.json();
        clearTimeout(quickReadTimer);
        if (!res.ok || data.error) throw new Error(data.error || "Explain failed");
        applyResources((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  stats: data.stats,
                  explanation: data.explanation,
                  explanationSource: "ai",
                  verdict: data.verdict,
                  aiError: data.aiError,
                  explaining: false,
                }
              : r
          )
        );
        logEvent("explained", data.aiError ? `AI explanation unavailable for ${name}` : `AI explanation ready for ${name}`);
      } catch {
        clearTimeout(quickReadTimer);
        applyResources((prev) =>
          prev.map((r) =>
            r.id === id
              ? {
                  ...r,
                  explaining: false,
                  aiError: true,
                  explanation: r.explanation ?? "AI explanation unavailable — showing raw signal only.",
                  explanationSource: r.explanationSource ?? "quick",
                  verdict: r.verdict ?? "unclear",
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
    const toExplain: { id: string; dailySpend: number[]; guardrailThresholdDollars?: number }[] = [];

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

        const guardrail = guardrailsRef.current[r.id];
        const guardrailBreached = eligibleForExplain && isGuardrailBreached(guardrail, stats.latest);

        // Hard-stop: the one path that acts without a human tap. Enforced
        // here again (not just in the Settings UI) since this is the one
        // place that would be dangerous to get wrong — only ever reachable
        // for a user-added platform with the toggle explicitly turned on.
        if (guardrailBreached && guardrail?.hardStopEnabled && r.isCustom) {
          const flat = stats.mean;
          const flatSpend = [...newDailySpend.slice(1), flat, flat, flat];
          logEvent(
            "autostop",
            `Auto-paused ${r.name} — guardrail hard-stop triggered at ${formatCurrency(stats.latest)}/day (limit was ${formatCurrency(guardrail.thresholdDollars)}/day)`
          );
          return {
            ...r,
            dailySpend: flatSpend,
            stats: analyzeSpend(flatSpend),
            paused: true,
            explaining: false,
          };
        }

        // A resource can already have a guardrail-only explanation from
        // an earlier, smaller breach. If it now ALSO crosses into a real
        // statistical anomaly for the first time, that's a materially
        // bigger story than "over budget" and deserves a fresh
        // explanation — not the stale small-breach text sitting there.
        // Gated on explainedForStats (not raw stats.flagged, which updates
        // every tick regardless of eligibility) so it fires exactly once.
        const newlyFlaggedByStats = eligibleForExplain && stats.flagged && (!r.explanation || !r.explainedForStats);
        const newlyFlaggedByGuardrail = guardrailBreached && !stats.flagged && !r.explanation;
        const newlyFlagged = newlyFlaggedByStats || newlyFlaggedByGuardrail;


        if (newlyFlagged) {
          toExplain.push({
            id: r.id,
            dailySpend: newDailySpend,
            guardrailThresholdDollars: newlyFlaggedByGuardrail ? guardrail?.thresholdDollars : undefined,
          });
          const pct = stats.mean > 0 ? ((stats.latest - stats.mean) / stats.mean) * 100 : 0;
          if (newlyFlaggedByGuardrail && guardrail) {
            logEvent(
              "guardrail",
              `${r.name} breached its ${formatCurrency(guardrail.thresholdDollars)}/day limit — spend at ${formatCurrency(stats.latest)}/day`
            );
          } else {
            logEvent("anomaly", `${r.name} spend spiked to ${formatCurrency(stats.latest)} (${formatPercent(pct)})`);
          }
        }

        return {
          ...r,
          dailySpend: newDailySpend,
          stats,
          explaining: newlyFlagged,
          flaggedAt: newlyFlagged ? Date.now() : r.flaggedAt,
          explainedForStats: newlyFlaggedByStats ? true : r.explainedForStats,
          // Upgrading past a stale guardrail-only explanation: clear it so
          // the panel shows "reading the numbers" instead of the old,
          // now-misleading text while the fresh explanation is in flight.
          ...(newlyFlaggedByStats
            ? { explanation: undefined, explanationSource: undefined, verdict: undefined, aiError: undefined }
            : {}),
        };
      })
    );

    ticksRef.current += 1;
    setChecksRun(ticksRef.current);
    setLastUpdated(Date.now());

    if (toExplain.length === 0 && ticksRef.current % HEARTBEAT_EVERY_N_TICKS === 0) {
      logEvent("heartbeat", `Routine check complete — ${resourcesRef.current.length} services normal`);
    }

    toExplain.forEach(({ id, dailySpend, guardrailThresholdDollars }) =>
      requestExplanation(id, dailySpend, guardrailThresholdDollars)
    );
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

  const handleSetGuardrail = useCallback(
    (guardrail: Guardrail) => {
      const next = { ...guardrailsRef.current, [guardrail.resourceId]: guardrail };
      guardrailsRef.current = next;
      setGuardrails(next);
      try {
        window.localStorage.setItem(GUARDRAILS_KEY, JSON.stringify(next));
      } catch {
        // ignore storage failures, the guardrail still works for this session
      }

      // If the new (or newly lowered) limit is already breached by
      // today's spend, fire the alert right away instead of waiting up
      // to one tick (~2.5s) for the interval to catch up.
      const resource = resourcesRef.current.find((r) => r.id === guardrail.resourceId);
      const alreadyHandled = !resource || resource.paused || resource.explaining || resource.explanation || resource.stats.flagged;
      if (!alreadyHandled && resource && isGuardrailBreached(guardrail, resource.stats.latest)) {
        if (guardrail.hardStopEnabled && resource.isCustom) {
          const flat = resource.stats.mean;
          const flatSpend = [...resource.dailySpend.slice(1), flat, flat, flat];
          applyResources((prev) =>
            prev.map((r) =>
              r.id === resource.id ? { ...r, dailySpend: flatSpend, stats: analyzeSpend(flatSpend), paused: true, explaining: false } : r
            )
          );
          logEvent(
            "autostop",
            `Auto-paused ${resource.name} — guardrail hard-stop triggered at ${formatCurrency(resource.stats.latest)}/day (limit was ${formatCurrency(guardrail.thresholdDollars)}/day)`
          );
        } else {
          applyResources((prev) =>
            prev.map((r) => (r.id === resource.id ? { ...r, explaining: true, flaggedAt: Date.now() } : r))
          );
          logEvent(
            "guardrail",
            `${resource.name} breached its ${formatCurrency(guardrail.thresholdDollars)}/day limit — spend at ${formatCurrency(resource.stats.latest)}/day`
          );
          requestExplanation(resource.id, resource.dailySpend, guardrail.thresholdDollars);
        }
      }
    },
    [applyResources, logEvent, requestExplanation]
  );

  const handleClearGuardrail = useCallback((resourceId: string) => {
    const next = { ...guardrailsRef.current };
    delete next[resourceId];
    guardrailsRef.current = next;
    setGuardrails(next);
    try {
      window.localStorage.setItem(GUARDRAILS_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures, the guardrail still works for this session
    }
  }, []);

  const persistCustomCatalog = useCallback((next: ServiceDef[]) => {
    customCatalogRef.current = next;
    setCustomCatalog(next);
    try {
      window.localStorage.setItem(CUSTOM_CATALOG_KEY, JSON.stringify(next));
    } catch {
      // ignore storage failures, the platform still works for this session
    }
  }, []);

  const handleAddService = useCallback(
    (input: CustomServiceInput) => {
      const def = createCustomServiceDef(input);
      persistCustomCatalog([...customCatalogRef.current, def]);
      const resource = toResourceResult(def, true);
      applyResources((prev) => [...prev, resource]);
      logEvent("service", `Added ${def.name} as a new connected service`);
      return def.id;
    },
    [applyResources, logEvent, persistCustomCatalog]
  );

  // One-click, fully repeatable demo scenario for a live walkthrough:
  // resets every resource to a clean baseline, drops in a custom
  // platform that's already over its limit and auto-stopped (so there's
  // no waiting to show that story), then kicks off the same real OpenAI
  // ramp as "Simulate spike" so the anomaly + AI explanation flow plays
  // out live. Safe to click again mid-demo — it always starts clean.
  const handleLoadDemo = useCallback(() => {
    rampTargets.current = {};

    const demoDef = createCustomServiceDef({
      name: "Datadog",
      provider: "Datadog",
      category: "other",
      estimatedDailySpend: 60,
      billedInTokens: false,
    });
    const nextCatalog = [...customCatalogRef.current.filter((d) => d.name !== "Datadog"), demoDef];
    persistCustomCatalog(nextCatalog);

    const fresh = buildInitialResources(nextCatalog);
    const next = fresh.map((r) => {
      if (r.id !== demoDef.id) return r;
      const overLimitSpend = [...r.dailySpend.slice(0, -1), 90];
      const overLimitStats = analyzeSpend(overLimitSpend);
      const flat = overLimitStats.mean;
      const flatSpend = [...overLimitSpend.slice(1), flat, flat, flat];
      return { ...r, dailySpend: flatSpend, stats: analyzeSpend(flatSpend), paused: true };
    });

    resourcesRef.current = next;
    setResources(next);
    setLastUpdated(Date.now());

    const nextGuardrails = {
      ...guardrailsRef.current,
      [demoDef.id]: { resourceId: demoDef.id, thresholdDollars: 40, enabled: true, hardStopEnabled: true },
    };
    guardrailsRef.current = nextGuardrails;
    setGuardrails(nextGuardrails);
    try {
      window.localStorage.setItem(GUARDRAILS_KEY, JSON.stringify(nextGuardrails));
    } catch {
      // ignore storage failures, demo still works for this session
    }

    logEvent("service", `Added ${demoDef.name} as a new connected service`);
    logEvent("guardrail", `${demoDef.name} breached its $40/day limit — spend at $90/day`);
    logEvent(
      "autostop",
      `Auto-paused ${demoDef.name} — guardrail hard-stop triggered at $90/day (limit was $40/day)`
    );

    rampTargets.current[SPIKE_TARGET_ID] = SPIKE_TARGET_VALUE;
    logEvent("heartbeat", "Demo scenario loaded — watch OpenAI over the next few checks");

    setDemoSignal((n) => n + 1);
  }, [logEvent, persistCustomCatalog]);

  const handleRemoveService = useCallback(
    (id: string) => {
      const def = customCatalogRef.current.find((d) => d.id === id);
      if (!def) return; // only user-added platforms can be removed
      delete rampTargets.current[id];
      persistCustomCatalog(customCatalogRef.current.filter((d) => d.id !== id));
      applyResources((prev) => prev.filter((r) => r.id !== id));
      logEvent("service", `Removed ${def.name} from connected services`);
    },
    [applyResources, logEvent, persistCustomCatalog]
  );

  const refreshNow = useCallback(() => {
    tick();
  }, [tick]);

  // "Active" means either statistically unusual OR currently over a
  // manually-set spend limit — a guardrail breach needs to show up here
  // too, not just generate an explanation nobody can see.
  const flagged = useMemo(
    () =>
      resources.filter(
        (r) => !r.paused && (r.stats.flagged || isGuardrailBreached(guardrails[r.id], r.stats.latest))
      ),
    [resources, guardrails]
  );

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
    guardrails,
    handleSetGuardrail,
    handleClearGuardrail,
    demoSignal,
    handleLoadDemo,
  };

  return <ResourcesContext.Provider value={value}>{children}</ResourcesContext.Provider>;
}

export function useResources(): ResourcesContextValue {
  const ctx = useContext(ResourcesContext);
  if (!ctx) throw new Error("useResources must be used within ResourcesProvider");
  return ctx;
}
