import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { getSupabaseAdmin, AD_PROJECTS_TABLE } from "@/lib/ad-studio-supabase";
import { adProjectInputSchema } from "@/lib/ad-studio-validation";
import { adProjectInputToRowFields } from "@/lib/ad-studio-serialize";

export async function GET(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const supabase = getSupabaseAdmin();
    const { data, error } = await supabase.from(AD_PROJECTS_TABLE).select("*").eq("id", id).single();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to load ad project." }, { status: 500 });
  }
}

/** Partial or full update. Accepts either a full validated project input, or a
 * small patch object (e.g. { claimsApproved: true }, { renderStatus: "Archived" }) —
 * whichever the caller sends is merged directly onto the row. */
export async function PATCH(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const body = await req.json();
    const supabase = getSupabaseAdmin();

    let updateFields: Record<string, unknown>;
    if (body.fullProject) {
      const input = adProjectInputSchema.parse(body.fullProject);
      updateFields = adProjectInputToRowFields(input);
    } else {
      // Shallow patch path (camelCase keys -> snake_case columns for the common ones).
      const camelToSnake: Record<string, string> = {
        projectName: "project_name",
        renderStatus: "render_status",
        claimsApproved: "claims_approved",
        archived: "archived",
        brandKitId: "brand_kit_id",
        aspectRatio: "aspect_ratio",
        selectedConcept: "selected_concept",
        scenes: "scenes",
        generatedCopy: "generated_copy",
        exportUrls: "export_urls"
      };
      updateFields = { updated_at: new Date().toISOString() };
      for (const [key, value] of Object.entries(body)) {
        const column = camelToSnake[key];
        if (column) updateFields[column] = value;
      }
    }

    const { data, error } = await supabase.from(AD_PROJECTS_TABLE).update(updateFields).eq("id", id).select().single();
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ item: data });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to update ad project." }, { status: 500 });
  }
}

/** DELETE ?archiveOnly=true archives instead of hard-deleting, matching the Mavely pattern. */
export async function DELETE(req: Request, { params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  try {
    const { searchParams } = new URL(req.url);
    const archiveOnly = searchParams.get("archiveOnly") === "true";
    const supabase = getSupabaseAdmin();

    if (archiveOnly) {
      const { error } = await supabase.from(AD_PROJECTS_TABLE).update({ archived: true, render_status: "Archived", updated_at: new Date().toISOString() }).eq("id", id);
      if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
      return NextResponse.json({ ok: true });
    }

    const { error } = await supabase.from(AD_PROJECTS_TABLE).delete().eq("id", id);
    if (error) return NextResponse.json({ error: `Supabase error: ${error.message}` }, { status: 500 });
    return NextResponse.json({ ok: true });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to delete ad project." }, { status: 500 });
  }
}
