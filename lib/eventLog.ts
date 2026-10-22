export type EventType = "connect" | "disconnect" | "anomaly" | "explained" | "pause" | "heartbeat" | "service";

export interface LogEvent {
  id: string;
  type: EventType;
  message: string;
  timestamp: number;
}

export const EVENTS_KEY = "bw_events";
export const MAX_EVENTS = 50;

export function makeEvent(type: EventType, message: string): LogEvent {
  return {
    id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
    type,
    message,
    timestamp: Date.now(),
  };
}
