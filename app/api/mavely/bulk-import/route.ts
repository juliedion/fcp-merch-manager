import { NextResponse } from "next/server";
import { parseCsv, csvRowsToRecords } from "@/lib/mavely-csv";
import { mavelyProductInputSchema, validateAffiliateUrl } from "@/lib/mavely-validation";
import { inputToRowFields } from "@/lib/mavely-serialize";
import { getSupabaseAdmin, MAVELY_TABLE } from "@/lib/mavely-supabase";

type RowResult = { row: number; title: string; ok: boolean; error?: string; id?: string };

function toInput(record: Record<string, string>) {
  const status = (record.status || "DRAFT").toUpperCase();
  return {
    title: record.title || "",
    descriptionHtml: record.description || "",
    retailerName: record.retailer_name || "",
    retailerUrl: record.retailer_url || "",
    mavelyLink: record.mavely_link || "",
    currentPrice: Number(record.current_price || 0),
    originalPrice: record.original_price ? Number(record.original_price) : null,
    images: (record.image_urls || "")
      .split(/[|,]/)
      .map(s => s.trim())
      .filter(Boolean),
    category: record.category || "",
    collection: record.collection || "",
    tags: (record.tags || "")
      .split(/[|,]/)
      .map(s => s.trim())
      .filter(Boolean),
    vendor: record.vendor || "",
    sku: "",
    buttonLabel: record.button_label || "Shop Now",
    seoTitle: record.seo_title || "",
    seoDescription: record.seo_description || "",
    shortSummary: "",
    status: status === "ACTIVE" ? "ACTIVE" : status === "ARCHIVED" ? "ARCHIVED" : "DRAFT"
  };
}

/**
 * Bulk-imports rows as local Supabase drafts (does not publish to Shopify — each row
 * still needs to be reviewed/published individually, consistent with the single-import
 * flow). Every row is validated independently; valid rows import even if others fail.
 */
export async function POST(req: Request) {
  try {
    const body = await req.json();
    const csvText: string = body?.csv || "";
    if (!csvText.trim()) return NextResponse.json({ error: "No CSV content provided." }, { status: 400 });

    const rows = parseCsv(csvText);
    const records = csvRowsToRecords(rows);
    if (!records.length) return NextResponse.json({ error: "CSV has no data rows." }, { status: 400 });

    const supabase = getSupabaseAdmin();
    const results: RowResult[] = [];

    for (let i = 0; i < records.length; i++) {
      const rowNumber = i + 2; // account for header row, 1-indexed
      const record = records[i];
      const candidate = toInput(record);
      const parsed = mavelyProductInputSchema.safeParse(candidate);
      if (!parsed.success) {
        results.push({ row: rowNumber, title: candidate.title || "(untitled)", ok: false, error: parsed.error.issues.map(i => i.message).join("; ") });
        continue;
      }
      const linkCheck = validateAffiliateUrl(parsed.data.mavelyLink);
      if (!linkCheck.valid) {
        results.push({ row: rowNumber, title: parsed.data.title, ok: false, error: linkCheck.error });
        continue;
      }

      const { data, error } = await supabase
        .from(MAVELY_TABLE)
        .insert({ ...inputToRowFields(parsed.data), archived: false })
        .select()
        .single();

      if (error) {
        results.push({ row: rowNumber, title: parsed.data.title, ok: false, error: `Supabase error: ${error.message}` });
        continue;
      }
      results.push({ row: rowNumber, title: parsed.data.title, ok: true, id: data.id });
    }

    return NextResponse.json({
      results,
      importedCount: results.filter(r => r.ok).length,
      failedCount: results.filter(r => !r.ok).length
    });
  } catch (error) {
    return NextResponse.json({ error: error instanceof Error ? error.message : "Bulk import failed." }, { status: 500 });
  }
}
