import { NextResponse } from "next/server";
import { z } from "zod";
import { formatApiError } from "@/lib/apiError";

const schema = z.object({
  prompt: z.string().min(2),
  negativePrompt: z.string().optional().default(""),
  aspectRatio: z.string().optional().default("1:1"),
  sourceImageUrl: z.string().url().optional(),
  referenceImageData: z.string().startsWith("data:image/").optional()
});

function sizeForAspectRatio(aspectRatio: string): string {
  const ratio = aspectRatio.toLowerCase();
  if (ratio.includes("9:16") || ratio.includes("4:5") || ratio.includes("portrait") || ratio.includes("story")) return "1024x1536";
  if (ratio.includes("16:9") || ratio.includes("5:4") || ratio.includes("landscape") || ratio.includes("banner")) return "1536x1024";
  return "1024x1024";
}

function dataUrlToBlob(dataUrl: string) {
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Uploaded reference image was not a valid base64 image.");
  const bytes = Buffer.from(match[2], "base64");
  return new Blob([bytes], { type: match[1] });
}

async function downloadReferenceImage(url: string) {
  const response = await fetch(url, {
    cache: "no-store",
    redirect: "follow",
    headers: {
      "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/131 Safari/537.36",
      "Accept": "image/avif,image/webp,image/apng,image/svg+xml,image/*,*/*;q=0.8",
      "Referer": url.includes("amazon.") || url.includes("media-amazon.") ? "https://www.amazon.com/" : new URL(url).origin + "/"
    }
  });
  if (!response.ok) throw new Error(`Could not download the source product image for AI generation (${response.status}).`);
  const contentType = response.headers.get("content-type") || "";
  if (!contentType.startsWith("image/")) throw new Error("The source product photo URL did not return an image.");
  const bytes = await response.arrayBuffer();
  if (!bytes.byteLength) throw new Error("The source product photo was empty.");
  return new Blob([bytes], { type: contentType.split(";")[0] || "image/jpeg" });
}

function filenameFor(blob: Blob, fallback: string) {
  if (blob.type.includes("png")) return `${fallback}.png`;
  if (blob.type.includes("webp")) return `${fallback}.webp`;
  return `${fallback}.jpg`;
}

export async function POST(req: Request) {
  try {
    const { prompt, negativePrompt, aspectRatio, sourceImageUrl, referenceImageData } = schema.parse(await req.json());
    const apiKey = process.env.OPENAI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: "OPENAI_API_KEY is not configured on the server." }, { status: 400 });

    // Image edits require a GPT Image model. A stale DALL-E env override used to make
    // the UGC button silently fail after a valid product import.
    const configuredModel = process.env.OPENAI_IMAGE_MODEL || "gpt-image-1";
    const model = configuredModel.toLowerCase().startsWith("gpt-image") ? configuredModel : "gpt-image-1";

    const referenceNote = referenceImageData
      ? " An additional uploaded reference image is supplied for the person, environment, pose, composition, mood, styling, or visual direction. The first/product image remains the source of truth for the merchandise itself."
      : "";
    const fullPrompt = `${prompt}\n\nCRITICAL PRODUCT FIDELITY: Keep the product visually faithful to the supplied product-reference photo: same product, shape, color, proportions, controls, attachments, materials, branding, and recognizable design. Do not invent logos, text, accessories, functions, or product features.${referenceNote}${negativePrompt ? `\n\nAvoid: ${negativePrompt}` : ""}`;

    let r: Response;
    if (sourceImageUrl || referenceImageData) {
      const form = new FormData();
      form.append("model", model);
      form.append("prompt", fullPrompt);
      form.append("size", sizeForAspectRatio(aspectRatio));
      form.append("n", "1");

      if (sourceImageUrl) {
        const productBlob = await downloadReferenceImage(sourceImageUrl);
        if (referenceImageData) {
          form.append("image[]", productBlob, filenameFor(productBlob, "product-reference"));
          const creativeBlob = dataUrlToBlob(referenceImageData);
          form.append("image[]", creativeBlob, filenameFor(creativeBlob, "creative-reference"));
        } else {
          form.append("image", productBlob, filenameFor(productBlob, "product-reference"));
        }
      } else if (referenceImageData) {
        const creativeBlob = dataUrlToBlob(referenceImageData);
        form.append("image", creativeBlob, filenameFor(creativeBlob, "creative-reference"));
      }

      r = await fetch("https://api.openai.com/v1/images/edits", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}` },
        body: form
      });
    } else {
      r = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({ model, prompt: fullPrompt, size: sizeForAspectRatio(aspectRatio), n: 1 })
      });
    }

    const data = await r.json().catch(() => ({}));
    if (!r.ok) {
      const upstream = data?.error?.message || data?.message || `OpenAI image request failed (${r.status}).`;
      return NextResponse.json({ error: upstream }, { status: r.status });
    }
    const b64 = data?.data?.[0]?.b64_json;
    const url = data?.data?.[0]?.url;
    if (!b64 && !url) return NextResponse.json({ error: "OpenAI returned no image data." }, { status: 502 });
    return NextResponse.json({ imageUrl: url || `data:image/png;base64,${b64}` });
  } catch (error) {
    return NextResponse.json({ error: formatApiError(error, "Invalid image request.") }, { status: 400 });
  }
}
