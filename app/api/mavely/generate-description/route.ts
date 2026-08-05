import { NextResponse } from "next/server";
import { z } from "zod";
import { generateMavelyDescription, sectionsToHtml } from "@/lib/mavely-generator";

const schema = z.object({
  title: z.string().min(1),
  shortSummary: z.string().default(""),
  retailerName: z.string().default(""),
  category: z.string().default(""),
  tags: z.array(z.string()).default([]),
  featuresText: z.string().default("")
});

export async function POST(req: Request) {
  try {
    const input = schema.parse(await req.json());
    const sections = generateMavelyDescription(input);
    return NextResponse.json({ sections, descriptionHtml: sectionsToHtml(sections) });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Could not generate description." }, { status: 400 });
  }
}
