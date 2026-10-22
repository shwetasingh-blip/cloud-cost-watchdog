import { NextRequest, NextResponse } from "next/server";
import { getSupabase, errorMessage } from "@/lib/supabase";
import { makeEvent, type EventType } from "@/lib/eventLog";

const VALID_TYPES: EventType[] = ["connect", "disconnect", "anomaly", "explained", "pause", "heartbeat", "service"];

// Fire-and-forget from the client: appends one event to the shared,
// persisted activity log. The client already shows it optimistically;
// this just makes it durable and visible to everyone else.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const type = body?.type;
    const message = typeof body?.message === "string" ? body.message.slice(0, 300) : "";

    if (!VALID_TYPES.includes(type) || !message) {
      return NextResponse.json({ error: "Invalid type or message." }, { status: 400 });
    }

    const event = makeEvent(type, message);
    const supabase = getSupabase();
    const { error } = await supabase.from("events").insert({
      id: event.id,
      type: event.type,
      message: event.message,
      timestamp: event.timestamp,
    });
    if (error) throw error;

    return NextResponse.json({ event });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not record event.", detail: errorMessage(err) },
      { status: 500 }
    );
  }
}
