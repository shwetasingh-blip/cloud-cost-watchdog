import { NextRequest, NextResponse } from "next/server";
import { getServiceDef } from "@/lib/mockData";
import { getSupabase, errorMessage } from "@/lib/supabase";

// Simulated action only — no real cloud API is called. Confirms the
// resource is one we know about, then durably records the pause in the
// shared database before reporting success, so "paused" means the same
// thing on every device, not just in the browser that clicked it.
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const resourceId = body?.resourceId;

    if (!resourceId || typeof resourceId !== "string") {
      return NextResponse.json({ error: "Missing resourceId." }, { status: 400 });
    }

    // A built-in service is verified against the server's own catalog; a
    // user-added platform only exists in the shared database, so the
    // client vouches for it with its own name instead.
    const isKnownBuiltIn = Boolean(getServiceDef(resourceId));
    const isKnownCustom = typeof body?.resourceName === "string" && body.resourceName.trim().length > 0;
    if (!isKnownBuiltIn && !isKnownCustom) {
      return NextResponse.json({ error: "Unknown resource." }, { status: 400 });
    }

    const pausedAt = Date.now();
    const supabase = getSupabase();
    const { error } = await supabase
      .from("resource_overrides")
      .upsert({ id: resourceId, paused: true, paused_at: pausedAt, updated_at: new Date().toISOString() });
    if (error) throw error;

    return NextResponse.json({
      success: true,
      resourceId,
      pausedAt: new Date(pausedAt).toISOString(),
    });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not process pause request.", detail: errorMessage(err) },
      { status: 500 }
    );
  }
}
