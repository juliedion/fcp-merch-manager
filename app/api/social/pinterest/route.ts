import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const token = process.env.PINTEREST_ACCESS_TOKEN;
    const boardId = process.env.PINTEREST_BOARD_ID;
    if (!token || !boardId) {
      return NextResponse.json({ error: "Pinterest is not configured yet. Add PINTEREST_ACCESS_TOKEN and PINTEREST_BOARD_ID in Vercel." }, { status: 503 });
    }
    const { title, description, imageUrl, link } = await req.json();
    if (!title || !description || !imageUrl) return NextResponse.json({ error: "Pin title, description, and image are required." }, { status: 400 });
    if (!/^https?:\/\//i.test(String(imageUrl))) return NextResponse.json({ error: "Pinterest requires a publicly hosted image. Generate the UGC image again after Shopify image hosting is configured." }, { status: 400 });

    const r = await fetch("https://api.pinterest.com/v5/pins", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${token}` },
      body: JSON.stringify({
        board_id: boardId,
        title: String(title).slice(0, 100),
        description: String(description).slice(0, 800),
        link: /^https?:\/\//i.test(String(link || "")) ? link : undefined,
        media_source: { source_type: "image_url", url: imageUrl }
      })
    });
    const data = await r.json();
    if (!r.ok) return NextResponse.json({ error: data?.message || data?.error?.message || "Pinterest posting failed." }, { status: r.status });
    return NextResponse.json({ ok: true, id: data.id });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Pinterest posting failed." }, { status: 400 });
  }
}
