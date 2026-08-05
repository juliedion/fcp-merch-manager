"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import AppShell from "@/components/AppShell";
import { MavelyProductRow } from "@/lib/mavely-types";
import { looksLikeMavelyDomain } from "@/lib/mavely-validation";

function linkStatus(row: MavelyProductRow) {
  if (!row.mavely_link) return { label: "Missing", tone: "bad" };
  if (!/^https:\/\//i.test(row.mavely_link)) return { label: "Looks invalid", tone: "bad" };
  if (!looksLikeMavelyDomain(row.mavely_link)) return { label: "Present (unverified domain)", tone: "warn" };
  return { label: "Present", tone: "ok" };
}

export default function MavelyDashboard() {
  const [items, setItems] = useState<MavelyProductRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<MavelyProductRow | null>(null);
  const [deleteShopifyToo, setDeleteShopifyToo] = useState(false);
  const [busyId, setBusyId] = useState<string | null>(null);

  async function load() {
    setLoading(true);
    try {
      const res = await fetch("/api/mavely/products");
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not load products.");
        return;
      }
      setItems(data.items || []);
    } catch {
      setError("Could not load products.");
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    load();
  }, []);

  async function archive(row: MavelyProductRow) {
    setBusyId(row.id);
    await fetch(`/api/mavely/products/${row.id}?archiveOnly=true`, { method: "DELETE" });
    setBusyId(null);
    load();
  }

  async function confirmedDelete() {
    if (!confirmDelete) return;
    setBusyId(confirmDelete.id);
    await fetch(`/api/mavely/products/${confirmDelete.id}?deleteShopifyToo=${deleteShopifyToo}`, { method: "DELETE" });
    setBusyId(null);
    setConfirmDelete(null);
    setDeleteShopifyToo(false);
    load();
  }

  async function duplicate(row: MavelyProductRow) {
    setBusyId(row.id);
    await fetch("/api/mavely/products", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        retailerUrl: row.retailer_url,
        mavelyLink: row.mavely_link,
        title: `${row.title} (copy)`,
        descriptionHtml: row.description_html,
        shortSummary: row.short_summary,
        retailerName: row.retailer_name,
        currentPrice: row.current_price,
        originalPrice: row.original_price,
        images: row.images,
        category: row.category,
        collection: row.collection,
        tags: row.tags,
        vendor: row.vendor,
        sku: "",
        buttonLabel: row.button_label,
        seoTitle: row.seo_title,
        seoDescription: row.seo_description,
        status: "DRAFT"
      })
    });
    setBusyId(null);
    load();
  }

  return (
    <AppShell>
      <div className="top">
        <div>
          <div className="eyebrow">Mavely Affiliate Importer</div>
          <h1 className="title">Affiliate products</h1>
          <div className="muted">Every imported Mavely affiliate product lives here.</div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <Link className="secondary" href="/mavely/bulk-import">
            Bulk CSV import
          </Link>
          <Link className="primary" href="/mavely/new">
            + Add product
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
                  <th style={{ padding: 8 }}>Image</th>
                  <th style={{ padding: 8 }}>Title</th>
                  <th style={{ padding: 8 }}>Retailer</th>
                  <th style={{ padding: 8 }}>Price</th>
                  <th style={{ padding: 8 }}>Shopify status</th>
                  <th style={{ padding: 8 }}>Mavely link</th>
                  <th style={{ padding: 8 }}>Imported</th>
                  <th style={{ padding: 8 }}>Updated</th>
                  <th style={{ padding: 8 }}>Shopify ID</th>
                  <th style={{ padding: 8 }}>Actions</th>
                </tr>
              </thead>
              <tbody>
                {items.map(row => {
                  const link = linkStatus(row);
                  return (
                    <tr key={row.id} style={{ borderTop: "1px solid #eee" }}>
                      <td style={{ padding: 8 }}>
                        {row.images?.[0] ? <img src={row.images[0]} alt="" style={{ width: 40, height: 40, objectFit: "cover", borderRadius: 8 }} /> : "—"}
                      </td>
                      <td style={{ padding: 8, maxWidth: 220 }}>{row.title}</td>
                      <td style={{ padding: 8 }}>{row.retailer_name || "—"}</td>
                      <td style={{ padding: 8 }}>${Number(row.current_price).toFixed(2)}</td>
                      <td style={{ padding: 8 }}>
                        <span className="badge">{row.shopify_product_id ? row.status : "Not published"}</span>
                      </td>
                      <td style={{ padding: 8 }}>
                        <span className="badge">{link.label}</span>
                      </td>
                      <td style={{ padding: 8, fontSize: 12 }}>{new Date(row.created_at).toLocaleDateString()}</td>
                      <td style={{ padding: 8, fontSize: 12 }}>{new Date(row.updated_at).toLocaleDateString()}</td>
                      <td style={{ padding: 8, fontSize: 12 }}>{row.shopify_product_id ? row.shopify_product_id.replace("gid://shopify/Product/", "") : "—"}</td>
                      <td style={{ padding: 8 }}>
                        <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                          <Link className="secondary" href={`/mavely/${row.id}/edit`}>
                            Edit
                          </Link>
                          {row.shopify_storefront_url && (
                            <a className="secondary" href={row.shopify_storefront_url} target="_blank" rel="noopener noreferrer">
                              Preview
                            </a>
                          )}
                          {row.shopify_admin_url && (
                            <a className="secondary" href={row.shopify_admin_url} target="_blank" rel="noopener noreferrer">
                              Shopify
                            </a>
                          )}
                          {row.retailer_url && (
                            <a className="secondary" href={row.retailer_url} target="_blank" rel="noopener noreferrer">
                              Retailer
                            </a>
                          )}
                          {row.mavely_link && (
                            <a className="secondary" href={row.mavely_link} target="_blank" rel="sponsored nofollow noopener">
                              Mavely
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
                  );
                })}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="empty">
            <h2>No affiliate products yet</h2>
            <p>Add your first Mavely affiliate product to get started.</p>
          </div>
        )}
      </section>

      {confirmDelete && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background: "rgba(6,63,66,.55)",
            display: "grid",
            placeItems: "center",
            zIndex: 50
          }}
        >
          <div className="card" style={{ width: 420 }}>
            <h2>Delete "{confirmDelete.title}"?</h2>
            <p className="muted">This removes the record from the Merch Manager library.</p>
            {confirmDelete.shopify_product_id && (
              <label style={{ display: "flex", gap: 8, alignItems: "center", fontSize: 13, marginTop: 10 }}>
                <input type="checkbox" checked={deleteShopifyToo} onChange={e => setDeleteShopifyToo(e.target.checked)} />
                Also delete the live Shopify product ({confirmDelete.shopify_product_id.replace("gid://shopify/Product/", "")})
              </label>
            )}
            <div className="actions">
              <button
                className="secondary"
                onClick={() => {
                  setConfirmDelete(null);
                  setDeleteShopifyToo(false);
                }}
              >
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
