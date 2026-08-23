import { NextResponse } from "next/server";
import { z } from "zod";
import { formatApiError } from "@/lib/apiError";

const schema = z.object({
  prompt: z.string().min(2),
  negativePrompt: z.string().optional().default(""),
  aspectRatio: z.string().optional().default("1:1"),
  sourceImageUrl: z.string().url().optional()
});

function sizeForAspectRatio(aspectRatio: string): string {
  if (aspectRatio.includes("9:16") || aspectRatio.toLowerCase().includes("story")) return "1024x1536";
  if (aspectRatio.includes("16:9") || aspectRatio.toLowerCase().includes("banner")) return "1536x1024";
  return "1024x1024";
}

export async function POST(req: Request) {
  try {
    const { prompt, negativePrompt, aspectRatio, sourceImageUrl } = schema.parse(await req.json());
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 400 });

    const fullPrompt = `${prompt}\n\nKeep the product itself visually faithful to the supplied reference photo: same shape, color, proportions, controls, attachments, materials, and recognizable design. Do not invent logos, text, accessories, or product features.${negativePrompt ? `\n\nAvoid: ${negativePrompt}` : ""}`;

    let r: Response;
    if (sourceImageUrl) {
      const imageResponse = await fetch(sourceImageUrl, { cache: "no-store" });
      if (!imageResponse.ok) throw new Error("Could not download the source product image for UGC generation.");
      const imageBlob = await imageResponse.blob();
      const form = new FormData();
      form.append("model", process.env.OPENAI_IMAGE_MODEL || "gpt-image-1");
      form.append("prompt", fullPrompt);
      form.append("size", sizeForAspectRatio(aspectRatio));
      form.append("n", "1");
      form.append("image", imageBlob, "product-reference.png");
      r = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form
      });
    } else {
      r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model: process.env.OPENAI_IMAGE_MODEL || "gpt-image-1",
          prompt: fullPrompt,
          size: sizeForAspectRatio(aspectRatio),
          n: 1
        })
      });
    }

    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data?.error?.message || "Image generation failed." }, { status: r.status });
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    if (!b64 && !url) return NextResponse.json({ error: "OpenAI returned no image data." }, { status: 502 });
    return NextResponse.json({ imageUrl: url || `data:image/png;base64,${b64}` });
  } catch (error) {
    return NextResponse.json({ error: formatApiError(error, "Invalid image request.") }, { status: 400 });
  }
}
