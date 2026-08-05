"use client";
import { useState } from "react";
import AppShell from "@/components/AppShell";

type RowResult = { row: number; title: string; ok: boolean; error?: string; id?: string };

export default function BulkImportPage() {
  const [csv, setCsv] = useState("");
  const [fileName, setFileName] = useState("");
  const [busy, setBusy] = useState(false);
  const [results, setResults] = useState<RowResult[] | null>(null);
  const [error, setError] = useState("");

  function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = () => setCsv(String(reader.result || ""));
    reader.readAsText(file);
  }

  async function submit() {
    setBusy(true);
    setError("");
    setResults(null);
    try {
      const res = await fetch("/api/mavely/bulk-import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ csv })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Bulk import failed.");
        return;
      }
      setResults(data.results);
    } catch {
      setError("Bulk import failed due to a network error.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <AppShell>
      <div className="top">
        <div>
          <div className="eyebrow">Mavely Affiliate Importer</div>
          <h1 className="title">Bulk CSV import</h1>
          <div className="muted">Import many affiliate products at once as drafts, then review and publish each one.</div>
        </div>
        <a className="secondary" href="/mavely-bulk-import-sample.csv" download>
          Download sample CSV
        </a>
      </div>

      <section className="card">
        <div className="field full">
          <label>CSV file</label>
          <input type="file" accept=".csv,text/csv" onChange={onFile} />
          {fileName && <div className="muted">Selected: {fileName}</div>}
        </div>
        <div className="field full">
          <label>Or paste CSV content</label>
          <textarea rows={10} value={csv} onChange={e => setCsv(e.target.value)} placeholder="title,description,retailer_name,retailer_url,mavely_link,..." />
        </div>
        {error && <div className="status">{error}</div>}
        <div className="actions">
          <button className="primary" onClick={submit} disabled={busy || !csv.trim()}>
            {busy ? "Importing…" : "Import CSV"}
          </button>
        </div>
      </section>

      {results && (
        <section className="card saved">
          <h2>
            Imported {results.filter(r => r.ok).length} of {results.length} rows
          </h2>
          <table style={{ width: "100%", borderCollapse: "collapse" }}>
            <thead>
              <tr style={{ textAlign: "left", fontSize: 12, color: "#657778" }}>
                <th style={{ padding: 8 }}>Row</th>
                <th style={{ padding: 8 }}>Title</th>
                <th style={{ padding: 8 }}>Result</th>
              </tr>
            </thead>
            <tbody>
              {results.map(r => (
                <tr key={r.row} style={{ borderTop: "1px solid #eee" }}>
                  <td style={{ padding: 8 }}>{r.row}</td>
                  <td style={{ padding: 8 }}>{r.title}</td>
                  <td style={{ padding: 8 }}>
                    {r.ok ? <span className="badge">Imported</span> : <span style={{ color: "#b3261e" }}>{r.error}</span>}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      )}
    </AppShell>
  );
}
