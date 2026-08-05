import { NextResponse } from "next/server";
import path from "node:path";
import os from "node:os";
import fs from "node:fs/promises";
import { z } from "zod";
import { bundle } from "@remotion/bundler";
import { renderMedia, selectComposition } from "@remotion/renderer";
import ffmpegInstaller from "@ffmpeg-installer/ffmpeg";
import { getSupabaseAdmin, AD_PROJECTS_TABLE, AD_STUDIO_BUCKET } from "@/lib/ad-studio-supabase";
import { ASPECT_RATIOS, AspectRatio } from "@/lib/ad-studio-types";

// ffmpeg is not preinstalled in the Vercel Node function runtime. We bundle a static
// binary via @ffmpeg-installer/ffmpeg and point @remotion/renderer at it explicitly,
// rather than relying on a system `ffmpeg` on PATH. See docs/ad-studio.md for the
// Vercel function-size/timeout tradeoffs of this approach.

export const runtime = "nodejs";
export const maxDuration = 60; // Phase 1 renders are capped short (~15-30s output); leaves headroom on Vercel's Node function timeout.

const renderRequestSchema = z.object({
  projectId: z.string().min(1)
});

export async function POST(req: Request) {
  let projectId = "";
  try {
    const body = await req.json();
    ({ projectId } = renderRequestSchema.parse(body));

    const supabase = getSupabaseAdmin();
    const { data: project, error: fetchError } = await supabase.from(AD_PROJECTS_TABLE).select("*").eq("id", projectId).single();
    if (fetchError || !project) return NextResponse.json({ error: "Ad project not found." }, { status: 404 });
    if (!project.claims_approved) {
      return NextResponse.json({ error: "Claims have not been approved yet. Complete the product-fact review step first." }, { status: 400 });
    }
    if (!project.scenes?.length) return NextResponse.json({ error: "This project has no scenes to render." }, { status: 400 });

    await supabase.from(AD_PROJECTS_TABLE).update({ render_status: "Rendering", updated_at: new Date().toISOString() }).eq("id", projectId);

    let brandKit = null;
    if (project.brand_kit_id) {
      const { data } = await supabase.from("brand_kits").select("*").eq("id", project.brand_kit_id).single();
      brandKit = data || null;
    }

    const aspectRatio = (project.aspect_ratio as AspectRatio) || "9:16";
    const dims = ASPECT_RATIOS.find(a => a.id === aspectRatio) || ASPECT_RATIOS[0];

    const entryPoint = path.join(process.cwd(), "remotion", "index.ts");
    const bundleLocation = await bundle({ entryPoint });

    const inputProps = { product: project.product_snapshot, scenes: project.scenes, brandKit, aspectRatio };

    const composition = await selectComposition({
      serveUrl: bundleLocation,
      id: "AdVideo",
      inputProps
    });

    const outDir = await fs.mkdtemp(path.join(os.tmpdir(), "ad-studio-"));
    const outputLocation = path.join(outDir, `${projectId}.mp4`);

    await renderMedia({
      composition: { ...composition, width: dims.width, height: dims.height },
      serveUrl: bundleLocation,
      codec: "h264",
      outputLocation,
      inputProps,
      binariesDirectory: path.dirname(ffmpegInstaller.path)
    });

    const fileBuffer = await fs.readFile(outputLocation);
    const storagePath = `${AD_STUDIO_BUCKET}/renders/${projectId}-${Date.now()}.mp4`;
    const { error: uploadError } = await supabase.storage.from(AD_STUDIO_BUCKET).upload(`renders/${projectId}-${Date.now()}.mp4`, fileBuffer, {
      contentType: "video/mp4",
      upsert: true
    });
    await fs.rm(outDir, { recursive: true, force: true });

    if (uploadError) {
      await supabase.from(AD_PROJECTS_TABLE).update({ render_status: "Failed", updated_at: new Date().toISOString() }).eq("id", projectId);
      return NextResponse.json({ error: `Supabase Storage upload failed: ${uploadError.message}` }, { status: 500 });
    }

    const { data: publicUrlData } = supabase.storage.from(AD_STUDIO_BUCKET).getPublicUrl(storagePath.replace(`${AD_STUDIO_BUCKET}/`, ""));
    const exportUrl = publicUrlData.publicUrl;

    const { data: updated } = await supabase
      .from(AD_PROJECTS_TABLE)
      .update({
        render_status: "Complete",
        export_urls: [...(project.export_urls || []), exportUrl],
        actual_cost: 0,
        updated_at: new Date().toISOString()
      })
      .eq("id", projectId)
      .select()
      .single();

    return NextResponse.json({ item: updated, exportUrl });
  } catch (error) {
    try {
      if (projectId) {
        const supabase = getSupabaseAdmin();
        await supabase.from(AD_PROJECTS_TABLE).update({ render_status: "Failed", updated_at: new Date().toISOString() }).eq("id", projectId);
      }
    } catch {
      // best-effort status update only
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Render failed." }, { status: 500 });
  }
}
