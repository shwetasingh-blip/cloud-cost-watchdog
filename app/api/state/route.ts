import { NextResponse } from "next/server";
import { getSupabase, errorMessage } from "@/lib/supabase";
import type { ServiceDef } from "@/lib/mockData";
import type { LogEvent } from "@/lib/eventLog";

// Everything a fresh page load needs from the shared backend, in one
// round trip: the custom platforms anyone has added, which resources
// are paused, and the recent activity history.
export async function GET() {
  try {
    const supabase = getSupabase();

    const [servicesRes, overridesRes, eventsRes] = await Promise.all([
      supabase.from("custom_services").select("*").order("created_at", { ascending: true }),
      supabase.from("resource_overrides").select("*").eq("paused", true),
      supabase.from("events").select("*").order("timestamp", { ascending: false }).limit(50),
    ]);

    if (servicesRes.error) throw servicesRes.error;
    if (overridesRes.error) throw overridesRes.error;
    if (eventsRes.error) throw eventsRes.error;

    const customServices: ServiceDef[] = (servicesRes.data ?? []).map((row) => ({
      id: row.id,
      name: row.name,
      provider: row.provider,
      category: row.category,
      unit: row.unit ?? undefined,
      costPerUnit: row.cost_per_unit ?? undefined,
      baseline: row.baseline,
      contextNote: row.context_note ?? "",
    }));

    const pausedIds: string[] = (overridesRes.data ?? []).map((row) => row.id);

    const events: LogEvent[] = (eventsRes.data ?? []).map((row) => ({
      id: row.id,
      type: row.type,
      message: row.message,
      timestamp: Number(row.timestamp),
    }));

    return NextResponse.json({ customServices, pausedIds, events });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not load shared state.", detail: errorMessage(err) },
      { status: 500 }
    );
  }
}
