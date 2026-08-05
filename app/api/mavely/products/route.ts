import { NextResponse } from "next/server";
import { getSupabaseAdmin, MAVELY_TABLE } from "@/lib/mavely-supabase";
import { mavelyProductInputSchema } from "@/lib/mavely-validation";
import { inputToRowFields } from "@/lib/mavely-serialize";
import { ZodError } from "zod";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(MAVELY_TABLE)
      .select("*")
      .eq("archived", false)
      .order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ items: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load products." }, { status: 500 });
  }
}

/** Saves a local draft record only — does not touch Shopify. Used by "Save Draft" in the wizard. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = mavelyProductInputSchema.parse(body);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(MAVELY_TABLE)
      .insert({ ...inputToRowFields(input), archived: false })
      .select()
      .single();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save draft." }, { status: 500 });
  }
}
