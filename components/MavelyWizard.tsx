"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { BUTTON_LABEL_PRESETS, MavelyProductInput } from "@/lib/mavely-types";

const STEPS = ["Product Source", "Product Details", "Images", "Shopify Organization", "Affiliate Settings", "Review"] as const;
type Step = (typeof STEPS)[number];

const EMPTY: MavelyProductInput = {
  retailerUrl: "",
  mavelyLink: "",
  title: "",
  descriptionHtml: "",
  shortSummary: "",
  retailerName: "",
  currentPrice: 0,
  originalPrice: null,
  images: [],
  category: "",
  collection: "",
  tags: [],
  vendor: "",
  sku: "",
  buttonLabel: "Shop Now",
  seoTitle: "",
  seoDescription: "",
  status: "DRAFT"
};

const DRAFT_KEY = "fcp-mavely-wizard-draft";

type DuplicateMatch = { id: string; title: string; matchedOn: string[]; shopifyProductId: string | null; shopifyAdminUrl: string | null };

export default function MavelyWizard({ existingId, initial }: { existingId?: string; initial?: MavelyProductInput }) {
  const router = useRouter();
  const [step, setStep] = useState<Step>("Product Source");
  const [form, setForm] = useState<MavelyProductInput>(initial || EMPTY);
  const [imageInput, setImageInput] = useState("");
  const [tagInput, setTagInput] = useState("");
  const [status, setStatus] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const [duplicates, setDuplicates] = useState<DuplicateMatch[] | null>(null);
  const [result, setResult] = useState<any>(null);
  const [importing, setImporting] = useState(false);
  const [linkWarning, setLinkWarning] = useState("");

  useEffect(() => {
    if (initial) return;
    try {
      const saved = localStorage.getItem(DRAFT_KEY);
      if (saved) setForm(JSON.parse(saved));
    } catch {
      // ignore corrupt draft
    }
  }, [initial]);

  useEffect(() => {
    if (existingId) return;
    try {
      localStorage.setItem(DRAFT_KEY, JSON.stringify(form));
    } catch {
      // storage may be unavailable; not critical
    }
  }, [form, existingId]);

  function update<K extends keyof MavelyProductInput>(key: K, value: MavelyProductInput[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  async function importFromUrl() {
    if (!form.retailerUrl.trim()) return;
    setImporting(true);
    setError("");
    try {
      const res = await fetch("/api/import-product", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: form.retailerUrl })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not import from that URL.");
        return;
      }
      setForm(f => ({
        ...f,
        title: f.title || data.title || "",
        descriptionHtml: f.descriptionHtml || (data.description ? `<p>${data.description}</p>` : ""),
        currentPrice: f.currentPrice || data.price || 0,
        category: f.category || data.category || "",
        images: f.images.length ? f.images : data.image ? [data.image] : []
      }));
      if (data.warning) setStatus(data.warning);
    } catch {
      setError("The import request failed. Enter details manually.");
    } finally {
      setImporting(false);
    }
  }

  function addImage() {
    const url = imageInput.trim();
    if (!url) return;
    update("images", [...form.images, url]);
    setImageInput("");
  }

  function removeImage(idx: number) {
    update("images", form.images.filter((_, i) => i !== idx));
  }

  function addTag() {
    const tag = tagInput.trim();
    if (!tag) return;
    update("tags", [...form.tags, tag]);
    setTagInput("");
  }

  function removeTag(idx: number) {
    update("tags", form.tags.filter((_, i) => i !== idx));
  }

  function generateDescription() {
    fetch("/api/mavely/generate-description", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        title: form.title,
        shortSummary: form.shortSummary,
        retailerName: form.retailerName,
        category: form.category,
        tags: form.tags
      })
    })
      .then(res => res.json())
      .then(data => {
        if (data.descriptionHtml) update("descriptionHtml", data.descriptionHtml);
      })
      .catch(() => setError("Could not generate a description right now."));
  }

  async function saveDraft() {
    setBusy(true);
    setError("");
    try {
      const res = await fetch("/api/mavely/products", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(form)
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not save draft.");
        return;
      }
      setStatus("Draft saved to the product library.");
      localStorage.removeItem(DRAFT_KEY);
      router.push("/mavely");
    } catch {
      setError("Could not save draft.");
    } finally {
      setBusy(false);
    }
  }

  async function publish(force = false) {
    setBusy(true);
    setError("");
    setLinkWarning("");
    try {
      const res = await fetch("/api/mavely/publish", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ input: form, existingId, force })
      });
      const data = await res.json();
      if (res.status === 409 && data.duplicateWarning) {
        setDuplicates(data.matches);
        return;
      }
      if (!res.ok) {
        setError(data.error || "Publishing failed.");
        return;
      }
      setResult(data);
      setDuplicates(null);
      if (data.linkWarning) setLinkWarning(data.linkWarning);
      localStorage.removeItem(DRAFT_KEY);
    } catch {
      setError("Publishing failed due to a network error.");
    } finally {
      setBusy(false);
    }
  }

  const stepIndex = STEPS.indexOf(step);

  const canContinue = useMemo(() => {
    if (step === "Product Details") return form.title.trim().length > 1;
    if (step === "Affiliate Settings") return /^https:\/\/\S+$/.test(form.mavelyLink.trim());
    return true;
  }, [step, form]);

  if (result) {
    return (
      <div className="card">
        <h2>Product published</h2>
        <p className="muted">
          Shopify product ID: <b>{result.shopify.numericId}</b> · Handle: <b>{result.shopify.handle}</b> · Status: <b>{result.shopify.status}</b>
        </p>
        {result.shopify.collectionWarning && <div className="status">{result.shopify.collectionWarning}</div>}
        {linkWarning && <div className="status">{linkWarning}</div>}
        <div className="actions">
          <a className="primary" href={result.shopify.adminUrl} target="_blank" rel="noopener noreferrer">
            Open in Shopify Admin
          </a>
          <a className="secondary" href={result.shopify.storefrontUrl} target="_blank" rel="noopener noreferrer">
            Preview on Storefront
          </a>
          <button className="secondary" onClick={() => router.push("/mavely")}>
            Back to Dashboard
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="grid">
      <section className="card">
        <div className="tabs">
          {STEPS.map((s, i) => (
            <button key={s} className={`tab ${s === step ? "on" : ""}`} onClick={() => setStep(s)} type="button">
              {i + 1}. {s}
            </button>
          ))}
        </div>

        {step === "Product Source" && (
          <div className="fields">
            <div className="field full">
              <label>Original retailer product URL</label>
              <input value={form.retailerUrl} onChange={e => update("retailerUrl", e.target.value)} placeholder="https://www.retailer.com/product/..." />
            </div>
            <div className="field full">
              <button type="button" className="secondary" onClick={importFromUrl} disabled={importing || !form.retailerUrl.trim()}>
                {importing ? "Importing…" : "Import details from URL"}
              </button>
            </div>
            <div className="field">
              <label>Retailer name</label>
              <input value={form.retailerName} onChange={e => update("retailerName", e.target.value)} placeholder="Walmart, Target, Amazon…" />
            </div>
            <div className="field">
              <label>SKU / internal reference</label>
              <input value={form.sku} onChange={e => update("sku", e.target.value)} />
            </div>
          </div>
        )}

        {step === "Product Details" && (
          <div className="fields">
            <div className="field full">
              <label>Product title</label>
              <input value={form.title} onChange={e => update("title", e.target.value)} />
            </div>
            <div className="field full">
              <label>Short product summary</label>
              <textarea rows={2} value={form.shortSummary} onChange={e => update("shortSummary", e.target.value)} />
            </div>
            <div className="field full">
              <label>Product description (HTML)</label>
              <textarea rows={8} value={form.descriptionHtml} onChange={e => update("descriptionHtml", e.target.value)} />
              <button type="button" className="secondary" onClick={generateDescription} style={{ justifySelf: "start" }}>
                Generate description from fields
              </button>
            </div>
            <div className="field">
              <label>Current price</label>
              <input type="number" step="0.01" value={form.currentPrice} onChange={e => update("currentPrice", Number(e.target.value))} />
            </div>
            <div className="field">
              <label>Original price</label>
              <input
                type="number"
                step="0.01"
                value={form.originalPrice ?? ""}
                onChange={e => update("originalPrice", e.target.value ? Number(e.target.value) : null)}
              />
            </div>
          </div>
        )}

        {step === "Images" && (
          <div className="fields">
            <div className="field full">
              <label>Product image URL</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={imageInput} onChange={e => setImageInput(e.target.value)} placeholder="https://…/image.jpg" />
                <button type="button" className="secondary" onClick={addImage}>
                  Add
                </button>
              </div>
            </div>
            <div className="field full">
              {form.images.map((src, i) => (
                <div key={i} style={{ display: "flex", alignItems: "center", gap: 10, padding: "6px 0" }}>
                  <img src={src} alt="" style={{ width: 48, height: 48, objectFit: "cover", borderRadius: 8 }} />
                  <span style={{ flex: 1, wordBreak: "break-all", fontSize: 13 }}>{src}</span>
                  <button type="button" className="secondary" onClick={() => removeImage(i)}>
                    Remove
                  </button>
                </div>
              ))}
              {!form.images.length && <div className="muted">No images added yet.</div>}
            </div>
          </div>
        )}

        {step === "Shopify Organization" && (
          <div className="fields">
            <div className="field">
              <label>Product category</label>
              <input value={form.category} onChange={e => update("category", e.target.value)} placeholder="e.g. Kitchen" />
            </div>
            <div className="field">
              <label>Shopify collection</label>
              <input value={form.collection} onChange={e => update("collection", e.target.value)} placeholder="Collection title" />
            </div>
            <div className="field">
              <label>Vendor</label>
              <input value={form.vendor} onChange={e => update("vendor", e.target.value)} />
            </div>
            <div className="field">
              <label>Status</label>
              <select value={form.status} onChange={e => update("status", e.target.value as any)}>
                <option value="DRAFT">Draft</option>
                <option value="ACTIVE">Active</option>
              </select>
            </div>
            <div className="field full">
              <label>Tags</label>
              <div style={{ display: "flex", gap: 8 }}>
                <input value={tagInput} onChange={e => setTagInput(e.target.value)} onKeyDown={e => e.key === "Enter" && (e.preventDefault(), addTag())} />
                <button type="button" className="secondary" onClick={addTag}>
                  Add
                </button>
              </div>
              <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 8 }}>
                {form.tags.map((tag, i) => (
                  <span key={i} className="badge" style={{ cursor: "pointer" }} onClick={() => removeTag(i)}>
                    {tag} ✕
                  </span>
                ))}
              </div>
            </div>
          </div>
        )}

        {step === "Affiliate Settings" && (
          <div className="fields">
            <div className="field full">
              <label>Mavely affiliate URL</label>
              <input value={form.mavelyLink} onChange={e => update("mavelyLink", e.target.value)} placeholder="https://mavely.app/..." />
            </div>
            <div className="field">
              <label>Button label</label>
              <select
                value={BUTTON_LABEL_PRESETS.includes(form.buttonLabel) ? form.buttonLabel : "__custom"}
                onChange={e => update("buttonLabel", e.target.value === "__custom" ? "" : e.target.value)}
              >
                {BUTTON_LABEL_PRESETS.map(p => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
                <option value="__custom">Custom…</option>
              </select>
            </div>
            {!BUTTON_LABEL_PRESETS.includes(form.buttonLabel) && (
              <div className="field">
                <label>Custom button label</label>
                <input value={form.buttonLabel} onChange={e => update("buttonLabel", e.target.value)} />
              </div>
            )}
            <div className="field full">
              <label>SEO title</label>
              <input value={form.seoTitle} onChange={e => update("seoTitle", e.target.value)} />
            </div>
            <div className="field full">
              <label>SEO meta description</label>
              <textarea rows={2} value={form.seoDescription} onChange={e => update("seoDescription", e.target.value)} />
            </div>
          </div>
        )}

        {step === "Review" && (
          <div>
            <h3 style={{ marginTop: 0 }}>This is exactly what will be sent to Shopify</h3>
            <div className="output">{JSON.stringify(form, null, 2)}</div>
          </div>
        )}

        {error && <div className="status">{error}</div>}
        {status && !error && <div className="status">{status}</div>}

        {duplicates && duplicates.length > 0 && (
          <div className="status">
            <b>Possible duplicate(s) found:</b>
            <ul>
              {duplicates.map(d => (
                <li key={d.id}>
                  {d.title} — matched on {d.matchedOn.join(", ")}
                  {d.shopifyAdminUrl && (
                    <>
                      {" "}
                      <a href={d.shopifyAdminUrl} target="_blank" rel="noopener noreferrer">
                        open existing
                      </a>
                    </>
                  )}
                </li>
              ))}
            </ul>
            <div className="actions">
              <button className="secondary" onClick={() => setDuplicates(null)}>
                Cancel
              </button>
              <button className="primary" onClick={() => publish(true)} disabled={busy}>
                Create anyway
              </button>
            </div>
          </div>
        )}

        <div className="actions">
          <button type="button" className="secondary" onClick={() => setStep(STEPS[Math.max(0, stepIndex - 1)])} disabled={stepIndex === 0}>
            Previous
          </button>
          {step !== "Review" && (
            <button type="button" className="primary" onClick={() => setStep(STEPS[Math.min(STEPS.length - 1, stepIndex + 1)])} disabled={!canContinue}>
              Continue
            </button>
          )}
          <button type="button" className="secondary" onClick={saveDraft} disabled={busy}>
            Save Draft
          </button>
          {step === "Review" && (
            <button type="button" className="primary" onClick={() => publish(false)} disabled={busy}>
              {busy ? "Publishing…" : existingId ? "Update Shopify Product" : "Publish Product"}
            </button>
          )}
        </div>
      </section>

      <aside className="card">
        <h2>Live preview</h2>
        {form.images[0] && <img src={form.images[0]} alt="" style={{ width: "100%", borderRadius: 12, marginBottom: 12 }} />}
        <h3 style={{ margin: "6px 0" }}>{form.title || "Product title"}</h3>
        <div className="muted" style={{ marginBottom: 8 }}>
          {form.retailerName || "Retailer"}
        </div>
        <div style={{ display: "flex", gap: 10, alignItems: "baseline", marginBottom: 10 }}>
          <b style={{ fontSize: 22 }}>${form.currentPrice.toFixed(2)}</b>
          {form.originalPrice ? <span style={{ textDecoration: "line-through", color: "#999" }}>${form.originalPrice.toFixed(2)}</span> : null}
        </div>
        <button className="primary" style={{ width: "100%" }} type="button" disabled>
          {form.buttonLabel || "Shop Now"}
        </button>
        <p className="muted" style={{ fontSize: 12, marginTop: 10 }}>
          Price shown was accurate when this product was added. Check the retailer for the latest price and availability.
        </p>
        <p className="muted" style={{ fontSize: 12 }}>
          Fort Crazypants may earn a commission when you purchase through links on this page, at no additional cost to you.
        </p>
      </aside>
    </div>
  );
}
