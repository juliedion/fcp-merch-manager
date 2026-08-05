import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabaseAdmin, AD_PROJECTS_TABLE } from "@/lib/ad-studio-supabase";
import { adProjectInputSchema } from "@/lib/ad-studio-validation";
import { adProjectInputToRowFields } from "@/lib/ad-studio-serialize";

export async function GET() {
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(AD_PROJECTS_TABLE).select("*").eq("archived", false).order("created_at", { ascending: false });
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ items: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load ad projects." }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const input = adProjectInputSchema.parse(body);
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase
      .from(AD_PROJECTS_TABLE)
      .insert({ ...adProjectInputToRowFields(input), archived: false })
      .select()
      .single();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to save ad project." }, { status: 500 });
  }
}
