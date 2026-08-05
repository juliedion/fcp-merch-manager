import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabaseAdmin, BRAND_KITS_TABLE } from "@/lib/ad-studio-supabase";
import { brandKitInputSchema } from "@/lib/ad-studio-validation";
import { brandKitInputToRowFields } from "@/lib/ad-studio-serialize";

/** Phase 1 manages a single default "Fort Crazypants Brand Kit" row. The data model
 * (brand_kits table) supports multiple kits, but the UI only edits the first/default
 * one for now — see docs/ad-studio.md. */
export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(BRAND_KITS_TABLE).select("*").order("created_at", { ascending: true }).limit(1).maybeSingle();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load brand kit." }, { status: 500 });
  }
}

/** Creates the default brand kit if none exists yet, or updates the existing one
 * (upsert-by-id when an id is included in the body). */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = brandKitInputSchema.parse(body);
    const supabase = getSupabaseAdmin();

    if (body.id) {
      const { data, error } = await supabase.from(BRAND_KITS_TABLE).update(brandKitInputToRowFields(input)).eq("id", body.id).select().single();
      if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
      return NextResponse.json({ item: data });
    }

    const { data, error } = await supabase.from(BRAND_KITS_TABLE).insert(brandKitInputToRowFields(input)).select().single();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save brand kit." }, { status: 500 });
  }
}
