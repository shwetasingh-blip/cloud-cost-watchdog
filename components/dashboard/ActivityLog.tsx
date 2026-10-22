"use client";

import { useEffect, useState } from "react";
import type { LogEvent, EventType } from "@/lib/eventLog";
import { formatRelativeTime } from "@/lib/format";

interface ActivityLogProps {
  events: LogEvent[];
  limit?: number;
}

const TYPE_LABEL: Record<EventType, string> = {
  connect: "Connected",
  disconnect: "Disconnected",
  anomaly: "Anomaly",
  explained: "AI",
  pause: "Paused",
  heartbeat: "Check",
  service: "Service",
  guardrail: "Guardrail",
  autostop: "Auto-stop",
};

export default function ActivityLog({ events, limit }: ActivityLogProps) {
  const [now, setNow] = useState(() => Date.now());

  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, []);

  const shown = limit ? events.slice(0, limit) : events;

  if (shown.length === 0) {
    return <div className="table-empty">No activity yet.</div>;
  }

  return (
    <div className="activity-log">
      {shown.map((e) => (
        <div className="activity-log__row" key={e.id}>
          <span className={`activity-log__dot activity-log__dot--${e.type}`} aria-hidden="true" />
          <span className="activity-log__type">{TYPE_LABEL[e.type]}</span>
          <span className="activity-log__message">{e.message}</span>
          <span className="activity-log__time">{formatRelativeTime(e.timestamp, now)}</span>
        </div>
      ))}
    </div>
  );
}
