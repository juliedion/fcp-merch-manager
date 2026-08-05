/** Minimal, dependency-free CSV parser. Handles quoted fields, embedded commas, and escaped quotes. */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let field = "";
  let inQuotes = false;
  const normalized = text.replace(/\r\n/g, "\n").replace(/\r/g, "\n");

  for (let i = 0; i < normalized.length; i++) {
    const char = normalized[i];
    if (inQuotes) {
      if (char === '"') {
        if (normalized[i + 1] === '"') {
          field += '"';
          i++;
        } else {
          inQuotes = false;
        }
      } else {
        field += char;
      }
      continue;
    }
    if (char === '"') {
      inQuotes = true;
    } else if (char === ",") {
      row.push(field);
      field = "";
    } else if (char === "\n") {
      row.push(field);
      rows.push(row);
      row = [];
      field = "";
    } else {
      field += char;
    }
  }
  if (field.length || row.length) {
    row.push(field);
    rows.push(row);
  }
  return rows.filter(r => r.some(c => c.trim() !== ""));
}

export const MAVELY_CSV_COLUMNS = [
  "title",
  "description",
  "retailer_name",
  "retailer_url",
  "mavely_link",
  "current_price",
  "original_price",
  "image_urls",
  "category",
  "collection",
  "tags",
  "vendor",
  "button_label",
  "seo_title",
  "seo_description",
  "status"
] as const;

export function csvRowsToRecords(rows: string[][]): Array<Record<string, string>> {
  if (!rows.length) return [];
  const header = rows[0].map(h => h.trim().toLowerCase());
  return rows.slice(1).map(cells => {
    const record: Record<string, string> = {};
    header.forEach((key, idx) => {
      record[key] = (cells[idx] ?? "").trim();
    });
    return record;
  });
}

function csvEscape(value: string): string {
  if (/[",\n]/.test(value)) return `"${value.replace(/"/g, '""')}"`;
  return value;
}

export function recordsToCsv(rows: Array<Record<string, string>>, columns: readonly string[]): string {
  const lines = [columns.join(",")];
  for (const row of rows) {
    lines.push(columns.map(col => csvEscape(row[col] ?? "")).join(","));
  }
  return lines.join("\n");
}
