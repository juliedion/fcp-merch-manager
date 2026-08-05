import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { conceptGenerateRequestSchema } from "@/lib/ad-studio-validation";
import { generateAdConcepts } from "@/lib/ad-studio-concept-generator";

/** POST /api/ad-studio/concepts — deterministic local concept generator (step 3).
 * No external AI call. Pass a different `seed` to "regenerate". */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { productSnapshot, audience, seed } = conceptGenerateRequestSchema.parse(body);
    const concepts = generateAdConcepts(productSnapshot, audience, seed ?? 0, 6);
    return NextResponse.json({ concepts });
  } catch (error) {
    if (error instanceof ZodError) {
      return NextResponse.json({ error: "Missing or invalid fields.", fieldErrors: error.flatten().fieldErrors }, { status: 400 });
    }
    return NextResponse.json({ error: error instanceof Error ? error.message : "Failed to generate concepts." }, { status: 500 });
  }
}
