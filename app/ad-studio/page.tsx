"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { AdProjectRow } from "@/lib/ad-studio-types";

export default function AdStudioDashboard() {
  const [items, setItems] = useState<AdProjectRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<AdProjectRow | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/ad-studio/projects");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load ad projects.");
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Could not load ad projects.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function archive(row: AdProjectRow) {
    setBusyId(row.id);
    await fetch(`/api/ad-studio/projects/${row.id}?archiveOnly=true`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  async function confirmedDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    await fetch(`/api/ad-studio/projects/${confirmDelete.id}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmDelete(null);
    load();
  }

  async function duplicate(row: AdProjectRow) {
    setBusyId(row.id);
    await fetch("/api/ad-studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        projectName: `${row.project_name} (copy)`,
        productSource: row.product_source,
        productSourceId: row.product_source_id,
        productSnapshot: row.product_snapshot,
        audience: row.audience,
        selectedConcept: row.selected_concept,
        scenes: row.scenes,
        brandKitId: row.brand_kit_id,
        aspectRatio: row.aspect_ratio,
        generatedCopy: row.generated_copy,
        costEstimate: 0,
        actualCost: 0,
        renderStatus: "Draft",
        claimsApproved: false,
        exportUrls: []
      })
    });
    setBusyId(null);
    load();
  }

  return (
    <AppShell>
      <div className="top">
        <div>
          <div className="eyebrow">FCP Ad Studio</div>
          <h1 className="title">Ad projects</h1>
          <div className="muted">Turn product photos into short-form vertical video ads.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="primary" href="/ad-studio/new">
            + New ad
          </Link>
        </div>
      </div>

      {error && <div className="status">{error}</div>}

      <section className="card">
        {loading ? (
          <div className="empty">Loading…</div>
        ) : items.length ? (
          <div style={{ overflowX: "auto" }}>
            <table style={{ width: "100%", borderCollapse: "collapse" }}>
              <thead>
                <tr style={{ textAlign: "left", fontSize: 12, color: "#657778" }}>
                  <th style={{ padding: 8 }}>Thumbnail</th>
                  <th style={{ padding: 8 }}>Project</th>
                  <th style={{ padding: 8 }}>Audience</th>
                  <th style={{ padding: 8 }}>Aspect</th>
                  <th style={{ padding: 8 }}>Status</th>
                  <th style={{ padding: 8 }}>Updated</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => (
                  <tr key={row.id} style={{ borderTop: "1px solid #eee" }}>
                    <td style={{ padding: 8 }}>
                      {row.product_snapshot?.images?.[0] ? (
                        <img src={row.product_snapshot.images[0]} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} />
                      ) : (
                        "—"
                      )}
                    </td>
                    <td style={{ padding: 8, maxWidth: 220 }}>{row.project_name}</td>
                    <td style={{ padding: 8 }}>{row.audience || "—"}</td>
                    <td style={{ padding: 8 }}>{row.aspect_ratio}</td>
                    <td style={{ padding: 8 }}>
                      <span className="badge">{row.render_status}</span>
                    </td>
                    <td style={{ padding: 8, fontSize: 12 }}>{new Date(row.updated_at).toLocaleDateString()}</td>
                    <td style={{ padding: 8 }}>
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        <Link className="secondary" href={`/ad-studio/new?projectId=${row.id}`}>
                          Open
                        </Link>
                        {row.export_urls?.[row.export_urls.length - 1] && (
                          <a className="secondary" href={row.export_urls[row.export_urls.length - 1]} target="_blank" rel="noopener noreferrer">
                            Download
                          </a>
                        )}
                        <button className="secondary" onClick={() => duplicate(row)} disabled={busyId === row.id}>
                          Duplicate
                        </button>
                        <button className="secondary" onClick={() => archive(row)} disabled={busyId === row.id}>
                          Archive
                        </button>
                        <button className="secondary" onClick={() => setConfirmDelete(row)} disabled={busyId === row.id}>
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h2>No ad projects yet</h2>
            <p>Start your first ad — select a product to begin.</p>
          </div>
        )}
      </section>

      {confirmDelete && (
        <div style={{ position: "fixed", inset: 0, background: "rgba(6,63,66,.55)", display: "grid", placeItems: "center", zIndex: 50 }}>
          <div className="card" style={{ width: 420 }}>
            <h2>Delete "{confirmDelete.project_name}"?</h2>
            <p className="muted">This removes the ad project (and its scene data) from the Merch Manager library. Rendered files already in Supabase Storage are not deleted automatically.</p>
            <div className="actions">
              <button className="secondary" onClick={() => setConfirmDelete(null)}>
                Cancel
              </button>
              <button className="primary" onClick={confirmedDelete} disabled={busyId === confirmDelete.id}>
                {busyId === confirmDelete.id ? "Deleting…" : "Confirm delete"}
              </button>
            </div>
          </div>
        </div>
      )}
    </AppShell>
  );
}
