import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { storyboardGenerateRequestSchema } from "@/lib/ad-studio-validation";
import { generateStoryboard } from "@/lib/ad-studio-storyboard-generator";
import { generateAdCopy } from "@/lib/ad-studio-copy-generator";

/** POST /api/ad-studio/storyboard — deterministic local storyboard + copy generator
 * (step 4). No external AI call. */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productSnapshot, concept, seed } = storyboardGenerateRequestSchema.parse(body);
    const scenes = generateStoryboard(productSnapshot, concept, seed ?? 0);
    const generatedCopy = generateAdCopy(productSnapshot, concept, scenes);
    return NextResponse.json({ scenes, generatedCopy });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate storyboard." }, { status: 500 });
  }
}
