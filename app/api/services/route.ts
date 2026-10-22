import { NextRequest, NextResponse } from "next/server";
import { getSupabase, errorMessage } from "@/lib/supabase";
import { createCustomServiceDef, type Category, type CustomServiceInput } from "@/lib/mockData";

const VALID_CATEGORIES: Category[] = ["ai", "cloud", "other"];

export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);

    const name = typeof body?.name === "string" ? body.name.trim().slice(0, 60) : "";
    const provider = typeof body?.provider === "string" ? body.provider.trim().slice(0, 40) : "";
    const category = body?.category;
    const estimatedDailySpend = Number(body?.estimatedDailySpend);
    const billedInTokens = Boolean(body?.billedInTokens);
    const costPerMillionTokens = Number(body?.costPerMillionTokens);

    if (!name) {
      return NextResponse.json({ error: "Platform name is required." }, { status: 400 });
    }
    if (!VALID_CATEGORIES.includes(category)) {
      return NextResponse.json({ error: "Invalid category." }, { status: 400 });
    }
    if (!Number.isFinite(estimatedDailySpend) || estimatedDailySpend <= 0) {
      return NextResponse.json({ error: "estimatedDailySpend must be a positive number." }, { status: 400 });
    }
    if (billedInTokens && (!Number.isFinite(costPerMillionTokens) || costPerMillionTokens <= 0)) {
      return NextResponse.json({ error: "costPerMillionTokens must be a positive number." }, { status: 400 });
    }

    const input: CustomServiceInput = {
      name,
      provider,
      category,
      estimatedDailySpend,
      billedInTokens,
      costPerMillionTokens: billedInTokens ? costPerMillionTokens : undefined,
    };
    const def = createCustomServiceDef(input);

    const supabase = getSupabase();
    const { error } = await supabase.from("custom_services").insert({
      id: def.id,
      name: def.name,
      provider: def.provider,
      category: def.category,
      unit: def.unit ?? null,
      cost_per_unit: def.costPerUnit ?? null,
      baseline: def.baseline,
      context_note: def.contextNote,
    });
    if (error) throw error;

    return NextResponse.json({ service: def });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not add platform.", detail: errorMessage(err) },
      { status: 500 }
    );
  }
}

export async function DELETE(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const id = typeof body?.id === "string" ? body.id : "";
    if (!id) {
      return NextResponse.json({ error: "Missing id." }, { status: 400 });
    }

    const supabase = getSupabase();
    const [a, b] = await Promise.all([
      supabase.from("custom_services").delete().eq("id", id),
      supabase.from("resource_overrides").delete().eq("id", id),
    ]);
    if (a.error) throw a.error;
    if (b.error) throw b.error;

    return NextResponse.json({ success: true });
  } catch (err) {
    return NextResponse.json(
      { error: "Could not remove platform.", detail: errorMessage(err) },
      { status: 500 }
    );
  }
}
