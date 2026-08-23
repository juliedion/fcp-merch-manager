import { NextResponse } from "next/server";

async function getAccessToken(domain: string): Promise<string> {
  const clientId = process.env.SHOPIFY_API_KEY;
  const clientSecret = process.env.SHOPIFY_API_SECRET;
  if (!clientId || !clientSecret) throw new Error("SHOPIFY_API_KEY / SHOPIFY_API_SECRET are not configured.");
  const r = await fetch(`https://${domain}/admin/oauth/access_token`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, grant_type: "client_credentials" })
  });
  const data = await r.json();
  if (!r.ok || !data.access_token) throw new Error(data.error_description || "Could not obtain a Shopify access token.");
  return data.access_token as string;
}

function dataUrlToBlob(dataUrl: string) {
  // Use [\s\S] instead of the ES2018-only `s` (dotAll) regex flag so this builds
  // with the project's current TypeScript target on Vercel.
  const match = dataUrl.match(/^data:([^;]+);base64,([\s\S]+)$/);
  if (!match) throw new Error("Expected a base64 image data URL.");
  const bytes = Buffer.from(match[2], "base64");
  return { mimeType: match[1], blob: new Blob([bytes], { type: match[1] }) };
}

export async function POST(req: Request) {
  try {
    const { dataUrl, filename = `ugc-${Date.now()}.png` } = await req.json();
    if (typeof dataUrl !== "string" || !dataUrl.startsWith("data:image/")) {
      return NextResponse.json({ error: "A base64 image dataUrl is required." }, { status: 400 });
    }
    const domain = process.env.SHOPIFY_STORE_DOMAIN;
    const version = process.env.SHOPIFY_API_VERSION || "2025-10";
    if (!domain) return NextResponse.json({ error: "Shopify credentials are not configured." }, { status: 503 });
    const token = await getAccessToken(domain);
    const { mimeType, blob } = dataUrlToBlob(dataUrl);

    const mutation = `mutation stagedUploadsCreate($input: [StagedUploadInput!]!) {
      stagedUploadsCreate(input: $input) {
        stagedTargets { url resourceUrl parameters { name value } }
        userErrors { field message }
      }
    }`;
    const variables = { input: [{ resource: "IMAGE", filename, mimeType, httpMethod: "POST" }] };
    const staged = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
      body: JSON.stringify({ query: mutation, variables })
    });
    const stagedData = await staged.json();
    const errors = stagedData?.data?.stagedUploadsCreate?.userErrors;
    if (!staged.ok || stagedData.errors || errors?.length) throw new Error(JSON.stringify(stagedData.errors || errors || "Could not stage image upload."));
    const target = stagedData.data.stagedUploadsCreate.stagedTargets?.[0];
    if (!target?.url || !target?.resourceUrl) throw new Error("Shopify returned no staged upload target.");

    const form = new FormData();
    for (const p of target.parameters || []) form.append(p.name, p.value);
    form.append("file", blob, filename);
    const upload = await fetch(target.url, { method: "POST", body: form });
    if (!upload.ok) throw new Error(`Shopify image upload failed (${upload.status}).`);

    // resourceUrl is a public/staged Shopify URL that productCreateMedia accepts as originalSource.
    return NextResponse.json({ imageUrl: target.resourceUrl });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Image upload failed." }, { status: 400 });
  }
}
