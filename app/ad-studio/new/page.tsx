"use client";
import { Suspense, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import dynamic from "next/dynamic";
import AppShell from "@/components/AppShell";
import {
  AdConcept,
  AdProductSnapshot,
  AdScene,
  ASPECT_RATIOS,
  AspectRatio,
  AUDIENCE_PRESETS,
  BrandKit,
  GeneratedCopy,
  MOTION_EFFECTS,
  MotionEffect,
  RenderStatus
} from "@/lib/ad-studio-types";
import { buildProductFactReview } from "@/lib/ad-studio-fact-check";
import { AdComposition } from "@/remotion/AdComposition";

const Player = dynamic(() => import("@remotion/player").then(m => m.Player), { ssr: false });

const STORAGE_KEY = "ad-studio-wizard-draft";
const STEPS = ["Select Product", "Audience", "Concept", "Storyboard", "Media & Motion", "Brand", "Voice & Music", "Preview", "Render & Export"];

const emptyProduct: AdProductSnapshot = {
  source: "shopify",
  sourceId: "",
  title: "",
  description: "",
  images: [],
  price: 0,
  compareAtPrice: null,
  vendor: "",
  productType: "",
  tags: [],
  collections: [],
  handle: "",
  productUrl: "",
  isAffiliate: false,
  affiliateUrl: null,
  retailerName: null,
  benefits: [],
  seoDescription: ""
};

function WizardInner() {
  const searchParams = useSearchParams();
  const mavelyId = searchParams.get("mavelyId");
  const existingProjectId = searchParams.get("projectId");

  const [step, setStep] = useState(1);
  const [projectId, setProjectId] = useState<string | null>(existingProjectId);
  const [projectName, setProjectName] = useState("Untitled ad");
  const [product, setProduct] = useState<AdProductSnapshot>(emptyProduct);
  const [audience, setAudience] = useState("");
  const [customAudience, setCustomAudience] = useState("");
  const [concepts, setConcepts] = useState<AdConcept[]>([]);
  const [concept, setConcept] = useState<AdConcept | null>(null);
  const [conceptSeed, setConceptSeed] = useState(0);
  const [scenes, setScenes] = useState<AdScene[]>([]);
  const [aspectRatio, setAspectRatio] = useState<AspectRatio>("9:16");
  const [brandKit, setBrandKit] = useState<BrandKit | null>(null);
  const [generatedCopy, setGeneratedCopy] = useState<GeneratedCopy | null>(null);
  const [claimsApproved, setClaimsApproved] = useState(false);
  const [renderStatus, setRenderStatus] = useState<RenderStatus>("Draft");
  const [exportUrl, setExportUrl] = useState<string | null>(null);
  const [rendering, setRendering] = useState(false);
  const [error, setError] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<AdProductSnapshot[]>([]);
  const [searching, setSearching] = useState(false);

  // Load an existing project, or pre-fill from a Mavely product, or restore the
  // localStorage safety-net draft — in that priority order.
  useEffect(() => {
    (async () => {
      if (existingProjectId) {
        const res = await fetch(`/api/ad-studio/projects/${existingProjectId}`);
        const data = await res.json();
        if (res.ok && data.item) {
          const row = data.item;
          setProjectId(row.id);
          setProjectName(row.project_name);
          setProduct(row.product_snapshot);
          setAudience(row.audience);
          setConcept(row.selected_concept);
          setScenes(row.scenes || []);
          setAspectRatio(row.aspect_ratio);
          setGeneratedCopy(row.generated_copy);
          setClaimsApproved(row.claims_approved);
          setRenderStatus(row.render_status);
          return;
        }
      }
      if (mavelyId) {
        const res = await fetch("/api/mavely/products");
        const data = await res.json();
        const row = (data.items || []).find((r: any) => r.id === mavelyId);
        if (row) {
          setProduct({
            source: "mavely",
            sourceId: row.id,
            title: row.title,
            description: row.short_summary || row.description_html?.replace(/<[^>]+>/g, " ") || "",
            images: row.images || [],
            price: Number(row.current_price) || 0,
            compareAtPrice: row.original_price ? Number(row.original_price) : null,
            vendor: row.vendor || "",
            productType: row.category || "",
            tags: row.tags || [],
            collections: row.collection ? [row.collection] : [],
            handle: "",
            productUrl: row.retailer_url || row.mavely_link || "",
            isAffiliate: true,
            affiliateUrl: row.mavely_link || row.retailer_url || "",
            retailerName: row.retailer_name || "",
            benefits: (row.short_summary || "").split(/[.\n]/).map((s: string) => s.trim()).filter(Boolean).slice(0, 6),
            seoDescription: row.seo_description || ""
          });
          setProjectName(`${row.title} ad`);
          return;
        }
      }
      const draft = typeof window !== "undefined" ? window.localStorage.getItem(STORAGE_KEY) : null;
      if (draft) {
        try {
          const parsed = JSON.parse(draft);
          if (parsed.product) setProduct(parsed.product);
          if (parsed.projectName) setProjectName(parsed.projectName);
          if (parsed.audience) setAudience(parsed.audience);
          if (parsed.concept) setConcept(parsed.concept);
          if (parsed.scenes) setScenes(parsed.scenes);
          if (parsed.aspectRatio) setAspectRatio(parsed.aspectRatio);
          if (parsed.step) setStep(parsed.step);
        } catch {
          // ignore corrupt draft
        }
      }
    })();
    // Load the (single, Phase 1) brand kit.
    fetch("/api/ad-studio/brand-kit")
      .then(r => r.json())
      .then(data => setBrandKit(data.item || null))
      .catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // localStorage safety net, mirroring the Mavely wizard's pattern.
  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify({ product, projectName, audience, concept, scenes, aspectRatio, step }));
  }, [product, projectName, audience, concept, scenes, aspectRatio, step]);

  const effectiveAudience = audience === "__custom__" ? customAudience : audience;

  async function searchProducts() {
    setSearching(true);
    try {
      const res = await fetch(`/api/ad-studio/products?q=${encodeURIComponent(searchQuery)}`);
      const data = await res.json();
      if (res.ok) setSearchResults(data.items || []);
      else setError(data.error || "Search failed.");
    } catch {
      setError("Could not search Shopify products. Check SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN.");
    } finally {
      setSearching(false);
    }
  }

  async function generateConcepts(seed: number) {
    setError("");
    try {
      const res = await fetch("/api/ad-studio/concepts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSnapshot: product, audience: effectiveAudience, seed })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not generate concepts.");
        return;
      }
      setConcepts(data.concepts);
    } catch {
      setError("Could not generate concepts.");
    }
  }

  async function generateStoryboardAndCopy(chosen: AdConcept) {
    setError("");
    try {
      const res = await fetch("/api/ad-studio/storyboard", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productSnapshot: product, concept: chosen })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Could not generate storyboard.");
        return;
      }
      setScenes(data.scenes);
      setGeneratedCopy(data.generatedCopy);
    } catch {
      setError("Could not generate storyboard.");
    }
  }

  function updateScene(id: string, patch: Partial<AdScene>) {
    setScenes(prev => prev.map(s => (s.id === id ? { ...s, ...patch } : s)));
  }

  function moveScene(index: number, direction: -1 | 1) {
    setScenes(prev => {
      const next = [...prev];
      const target = index + direction;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    });
  }

  function duplicateScene(index: number) {
    setScenes(prev => {
      const copy = { ...prev[index], id: `${prev[index].id}-copy-${Date.now()}` };
      const next = [...prev.slice(0, index + 1), copy, ...prev.slice(index + 1)];
      return next.map((s, i) => ({ ...s, sceneNumber: i + 1 }));
    });
  }

  function removeScene(index: number) {
    setScenes(prev => prev.filter((_, i) => i !== index).map((s, i) => ({ ...s, sceneNumber: i + 1 })));
  }

  async function saveProject(overrides: Record<string, unknown> = {}) {
    const payload = {
      projectName,
      productSource: product.source,
      productSourceId: product.sourceId,
      productSnapshot: product,
      audience: effectiveAudience,
      selectedConcept: concept,
      scenes,
      brandKitId: brandKit?.id || null,
      aspectRatio,
      generatedCopy,
      costEstimate: 0,
      actualCost: 0,
      renderStatus,
      claimsApproved,
      exportUrls: exportUrl ? [exportUrl] : [],
      ...overrides
    };
    if (projectId) {
      const res = await fetch(`/api/ad-studio/projects/${projectId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ fullProject: payload })
      });
      const data = await res.json();
      if (res.ok) return data.item;
      setError(data.error || "Could not save.");
      return null;
    }
    const res = await fetch("/api/ad-studio/projects", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload)
    });
    const data = await res.json();
    if (res.ok) {
      setProjectId(data.item.id);
      return data.item;
    }
    setError(data.error || "Could not save.");
    return null;
  }

  const factReview = useMemo(() => buildProductFactReview(product, scenes), [product, scenes]);

  async function render() {
    setError("");
    setRendering(true);
    try {
      const saved = await saveProject({ renderStatus: "Ready for Review" });
      const id = saved?.id || projectId;
      if (!id) throw new Error("Save the project before rendering.");
      const res = await fetch("/api/ad-studio/render", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ projectId: id })
      });
      const data = await res.json();
      if (!res.ok) {
        setError(data.error || "Render failed.");
        setRenderStatus("Failed");
        return;
      }
      setRenderStatus("Complete");
      setExportUrl(data.exportUrl);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Render failed.");
    } finally {
      setRendering(false);
    }
  }

  const dims = ASPECT_RATIOS.find(a => a.id === aspectRatio) || ASPECT_RATIOS[0];
  const totalDuration = scenes.reduce((sum, s) => sum + s.durationSeconds, 0);

  return (
    <AppShell>
      <div className="top">
        <div>
          <div className="eyebrow">FCP Ad Studio</div>
          <h1 className="title">
            <input
              className="field"
              style={{ fontSize: 22, fontWeight: 700, border: "none", padding: 0 }}
              value={projectName}
              onChange={e => setProjectName(e.target.value)}
            />
          </h1>
          <div className="muted">
            Step {step} of {STEPS.length}: {STEPS[step - 1]}
          </div>
        </div>
        <div style={{ display: "flex", gap: 10 }}>
          <button className="secondary" onClick={() => saveProject()}>
            Save draft
          </button>
        </div>
      </div>

      <div className="tabs" style={{ display: "flex", gap: 6, flexWrap: "wrap", marginBottom: 16 }}>
        {STEPS.map((label, i) => (
          <button key={label} className={i + 1 === step ? "primary" : "secondary"} onClick={() => setStep(i + 1)}>
            {i + 1}. {label}
          </button>
        ))}
      </div>

      {error && <div className="status">{error}</div>}

      {step === 1 && (
        <section className="card">
          <h2>Select product</h2>
          <p className="muted">Search live Shopify products, or arrive here pre-filled from a Mavely affiliate product.</p>
          <div style={{ display: "flex", gap: 8, marginBottom: 12 }}>
            <input className="field" placeholder="Search Shopify products by title…" value={searchQuery} onChange={e => setSearchQuery(e.target.value)} />
            <button className="secondary" onClick={searchProducts} disabled={searching}>
              {searching ? "Searching…" : "Search"}
            </button>
          </div>
          {searchResults.length > 0 && (
            <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))", gap: 10, marginBottom: 16 }}>
              {searchResults.map(p => (
                <button key={p.sourceId} className="secondary" style={{ textAlign: "left", padding: 8 }} onClick={() => setProduct(p)}>
                  {p.images[0] && <img src={p.images[0]} alt="" style={{ width: "100%", height: 90, objectFit: "cover", borderRadius: 6 }} />}
                  <div style={{ fontSize: 13, marginTop: 6 }}>{p.title}</div>
                </button>
              ))}
            </div>
          )}

          <h3>Product details (editable)</h3>
          <div className="field">
            <label>Title</label>
            <input className="field" value={product.title} onChange={e => setProduct({ ...product, title: e.target.value })} />
          </div>
          <div className="field">
            <label>Description</label>
            <textarea className="field" rows={3} value={product.description} onChange={e => setProduct({ ...product, description: e.target.value })} />
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Price</label>
              <input className="field" type="number" value={product.price} onChange={e => setProduct({ ...product, price: Number(e.target.value) })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Compare-at / original price</label>
              <input
                className="field"
                type="number"
                value={product.compareAtPrice ?? ""}
                onChange={e => setProduct({ ...product, compareAtPrice: e.target.value ? Number(e.target.value) : null })}
              />
            </div>
          </div>
          <div className="field">
            <label>Images (comma-separated URLs)</label>
            <textarea
              className="field"
              rows={2}
              value={product.images.join(", ")}
              onChange={e => setProduct({ ...product, images: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
            />
          </div>
          <div className="field">
            <label>Tags (comma-separated)</label>
            <input
              className="field"
              value={product.tags.join(", ")}
              onChange={e => setProduct({ ...product, tags: e.target.value.split(",").map(v => v.trim()).filter(Boolean) })}
            />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={product.isAffiliate} onChange={e => setProduct({ ...product, isAffiliate: e.target.checked })} />
            This is a Mavely / affiliate product (shows the affiliate disclosure automatically)
          </label>
          <div className="actions">
            <button className="primary" onClick={() => setStep(2)} disabled={!product.title}>
              Next: Audience
            </button>
          </div>
        </section>
      )}

      {step === 2 && (
        <section className="card">
          <h2>Choose audience</h2>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))", gap: 8 }}>
            {AUDIENCE_PRESETS.map(a => (
              <button key={a} className={audience === a ? "primary" : "secondary"} onClick={() => setAudience(a)}>
                {a}
              </button>
            ))}
            <button className={audience === "__custom__" ? "primary" : "secondary"} onClick={() => setAudience("__custom__")}>
              Custom…
            </button>
          </div>
          {audience === "__custom__" && (
            <div className="field" style={{ marginTop: 10 }}>
              <label>Custom audience</label>
              <input className="field" value={customAudience} onChange={e => setCustomAudience(e.target.value)} />
            </div>
          )}
          <div className="actions">
            <button className="secondary" onClick={() => setStep(1)}>
              Back
            </button>
            <button className="primary" onClick={() => setStep(3)} disabled={!effectiveAudience}>
              Next: Concept
            </button>
          </div>
        </section>
      )}

      {step === 3 && (
        <section className="card">
          <h2>Choose ad concept</h2>
          <div className="actions" style={{ marginBottom: 12 }}>
            <button className="secondary" onClick={() => generateConcepts(conceptSeed)}>
              {concepts.length ? "Generate again" : "Generate concepts"}
            </button>
            <button
              className="secondary"
              onClick={() => {
                const nextSeed = conceptSeed + 1;
                setConceptSeed(nextSeed);
                generateConcepts(nextSeed);
              }}
            >
              Regenerate (shuffle)
            </button>
          </div>
          <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(260px, 1fr))", gap: 12 }}>
            {concepts.map(c => (
              <div key={c.id} className="card" style={{ border: concept?.id === c.id ? "2px solid #063f42" : undefined }}>
                <div className="badge">{c.conceptType}</div>
                <h3>{c.title}</h3>
                <p className="muted">{c.coreProblem}</p>
                <p>
                  <strong>Hook:</strong> {c.openingHook}
                </p>
                <p>
                  <strong>CTA:</strong> {c.closingCta}
                </p>
                <p className="muted">
                  {c.recommendedDurationSeconds}s · Runway: {c.estimatedRunwayUsage} · Cost: {c.estimatedRenderingCost}
                </p>
                <button
                  className={concept?.id === c.id ? "primary" : "secondary"}
                  onClick={() => {
                    setConcept(c);
                    generateStoryboardAndCopy(c);
                  }}
                >
                  {concept?.id === c.id ? "Selected" : "Pick this concept"}
                </button>
              </div>
            ))}
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setStep(2)}>
              Back
            </button>
            <button className="primary" onClick={() => setStep(4)} disabled={!concept}>
              Next: Storyboard
            </button>
          </div>
        </section>
      )}

      {step === 4 && (
        <section className="card">
          <h2>Build storyboard</h2>
          <p className="muted">
            {scenes.length} scenes · ~{totalDuration.toFixed(1)}s total
          </p>
          {scenes.map((scene, index) => (
            <div key={scene.id} className="card" style={{ marginBottom: 10 }}>
              <div style={{ display: "flex", justifyContent: "space-between" }}>
                <strong>
                  Scene {scene.sceneNumber}: {scene.purpose}
                </strong>
                <div style={{ display: "flex", gap: 6 }}>
                  <button className="secondary" onClick={() => moveScene(index, -1)} disabled={index === 0}>
                    ↑
                  </button>
                  <button className="secondary" onClick={() => moveScene(index, 1)} disabled={index === scenes.length - 1}>
                    ↓
                  </button>
                  <button className="secondary" onClick={() => duplicateScene(index)}>
                    Duplicate
                  </button>
                  <button className="secondary" onClick={() => removeScene(index)} disabled={scenes.length <= 5}>
                    Remove
                  </button>
                </div>
              </div>
              <p className="muted">{scene.visualDescription}</p>
              <div className="field">
                <label>Duration (seconds)</label>
                <input className="field" type="number" value={scene.durationSeconds} onChange={e => updateScene(scene.id, { durationSeconds: Number(e.target.value) })} />
              </div>
              <div className="field">
                <label>On-screen text</label>
                <input className="field" value={scene.onScreenText} onChange={e => updateScene(scene.id, { onScreenText: e.target.value })} />
              </div>
              <div className="field">
                <label>Voice-over line (captured for script export only — no audio in Phase 1)</label>
                <input className="field" value={scene.voiceOverLine} onChange={e => updateScene(scene.id, { voiceOverLine: e.target.value })} />
              </div>
              <div className="field">
                <label>Recommended source</label>
                <select className="field" value={scene.recommendedSource} onChange={e => updateScene(scene.id, { recommendedSource: e.target.value as AdScene["recommendedSource"] })}>
                  <option value="product_image">Existing product image</option>
                  <option value="uploaded_image">Uploaded user image</option>
                  <option value="product_video">Existing product video</option>
                  <option value="ai_lifestyle_placeholder">AI lifestyle image (Phase 1: placeholder still)</option>
                  <option value="runway_animation" disabled>
                    Runway animation (available in a future update)
                  </option>
                  <option value="title_card">Branded title card</option>
                  <option value="cta_card">Branded CTA card</option>
                </select>
              </div>
              <div className="field">
                <label>Runway animation prompt (inert in Phase 1)</label>
                <input className="field" value={scene.runwayPrompt} disabled placeholder="Available in a future update" />
              </div>
              <div style={{ display: "flex", gap: 12 }}>
                <div className="field" style={{ flex: 1 }}>
                  <label>Sound effect (label only, Phase 1)</label>
                  <input className="field" value={scene.soundEffectLabel} onChange={e => updateScene(scene.id, { soundEffectLabel: e.target.value })} />
                </div>
                <div className="field" style={{ flex: 1 }}>
                  <label>Music intensity (label only, Phase 1)</label>
                  <input className="field" value={scene.musicIntensityLabel} onChange={e => updateScene(scene.id, { musicIntensityLabel: e.target.value })} />
                </div>
              </div>
              <p className="muted">Safe area: {scene.safeAreaNote}</p>
            </div>
          ))}
          <div className="actions">
            <button className="secondary" onClick={() => setStep(3)}>
              Back
            </button>
            <button className="primary" onClick={() => setStep(5)} disabled={scenes.length < 5}>
              Next: Select media
            </button>
          </div>
        </section>
      )}

      {step === 5 && (
        <section className="card">
          <h2>Select media & motion</h2>
          <div className="field">
            <label>Aspect ratio</label>
            <select className="field" value={aspectRatio} onChange={e => setAspectRatio(e.target.value as AspectRatio)}>
              {ASPECT_RATIOS.map(a => (
                <option key={a.id} value={a.id}>
                  {a.label}
                </option>
              ))}
            </select>
          </div>
          {scenes.map(scene => {
            const isMediaScene = scene.recommendedSource !== "title_card" && scene.recommendedSource !== "cta_card";
            return (
              <div key={scene.id} className="card" style={{ marginBottom: 10 }}>
                <strong>
                  Scene {scene.sceneNumber}: {scene.purpose}
                </strong>
                {isMediaScene && (
                  <>
                    <div className="field">
                      <label>Product image</label>
                      <select className="field" value={scene.productImageUrl || ""} onChange={e => updateScene(scene.id, { productImageUrl: e.target.value || null })}>
                        <option value="">— none —</option>
                        {product.images.map(img => (
                          <option key={img} value={img}>
                            {img}
                          </option>
                        ))}
                      </select>
                    </div>
                    <div className="field">
                      <label>Motion effect</label>
                      <select className="field" value={scene.motionEffect} onChange={e => updateScene(scene.id, { motionEffect: e.target.value as MotionEffect })}>
                        {MOTION_EFFECTS.map(m => (
                          <option key={m.id} value={m.id}>
                            {m.label}
                          </option>
                        ))}
                      </select>
                      {MOTION_EFFECTS.find(m => m.id === scene.motionEffect)?.simplified && (
                        <p className="muted">{MOTION_EFFECTS.find(m => m.id === scene.motionEffect)?.simplified}</p>
                      )}
                    </div>
                    {scene.motionEffect === "split_screen" && (
                      <div className="field">
                        <label>Secondary image (right side)</label>
                        <select className="field" value={scene.secondaryImageUrl || ""} onChange={e => updateScene(scene.id, { secondaryImageUrl: e.target.value || null })}>
                          <option value="">— none —</option>
                          {product.images.map(img => (
                            <option key={img} value={img}>
                              {img}
                            </option>
                          ))}
                        </select>
                      </div>
                    )}
                  </>
                )}
                {!isMediaScene && <p className="muted">Generated {scene.recommendedSource === "title_card" ? "title card" : "CTA card"} — no image selection needed.</p>}
              </div>
            );
          })}
          <div className="actions">
            <button className="secondary" onClick={() => setStep(4)}>
              Back
            </button>
            <button className="primary" onClick={() => setStep(6)}>
              Next: Brand
            </button>
          </div>
        </section>
      )}

      {step === 6 && brandKit && (
        <section className="card">
          <h2>Customize brand kit</h2>
          <p className="muted">One default Fort Crazypants Brand Kit. The logo is not burned into every scene by default — only CTA/title cards, unless watermark-all is on.</p>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Logo URL</label>
              <input className="field" value={brandKit.logo_url} onChange={e => setBrandKit({ ...brandKit, logo_url: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Website URL</label>
              <input className="field" value={brandKit.website_url} onChange={e => setBrandKit({ ...brandKit, website_url: e.target.value })} />
            </div>
          </div>
          <div style={{ display: "flex", gap: 12 }}>
            <div className="field" style={{ flex: 1 }}>
              <label>Primary color</label>
              <input className="field" type="color" value={brandKit.primary_color} onChange={e => setBrandKit({ ...brandKit, primary_color: e.target.value })} />
            </div>
            <div className="field" style={{ flex: 1 }}>
              <label>Secondary color</label>
              <input className="field" type="color" value={brandKit.secondary_color} onChange={e => setBrandKit({ ...brandKit, secondary_color: e.target.value })} />
            </div>
          </div>
          <div className="field">
            <label>Font choice</label>
            <input className="field" value={brandKit.font_choice} onChange={e => setBrandKit({ ...brandKit, font_choice: e.target.value })} />
          </div>
          <div className="field">
            <label>Default CTA text</label>
            <input className="field" value={brandKit.default_cta_text} onChange={e => setBrandKit({ ...brandKit, default_cta_text: e.target.value })} />
          </div>
          <div className="field">
            <label>Default disclosure text</label>
            <input className="field" value={brandKit.default_disclosure_text} onChange={e => setBrandKit({ ...brandKit, default_disclosure_text: e.target.value })} />
          </div>
          <div className="field">
            <label>Social handles</label>
            <input className="field" value={brandKit.social_handles} onChange={e => setBrandKit({ ...brandKit, social_handles: e.target.value })} />
          </div>
          <label style={{ display: "flex", gap: 8, alignItems: "center" }}>
            <input type="checkbox" checked={brandKit.watermark_all_scenes} onChange={e => setBrandKit({ ...brandKit, watermark_all_scenes: e.target.checked })} />
            Watermark logo on all scenes (not just CTA/title cards)
          </label>
          <div className="actions">
            <button className="secondary" onClick={() => setStep(5)}>
              Back
            </button>
            <button
              className="primary"
              onClick={async () => {
                await fetch("/api/ad-studio/brand-kit", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                    id: brandKit.id,
                    name: brandKit.name,
                    logoUrl: brandKit.logo_url,
                    primaryColor: brandKit.primary_color,
                    secondaryColor: brandKit.secondary_color,
                    fontChoice: brandKit.font_choice,
                    textStylePreset: brandKit.text_style_preset,
                    defaultCtaText: brandKit.default_cta_text,
                    defaultDisclosureText: brandKit.default_disclosure_text,
                    websiteUrl: brandKit.website_url,
                    socialHandles: brandKit.social_handles,
                    watermarkAllScenes: brandKit.watermark_all_scenes
                  })
                });
                setStep(7);
              }}
            >
              Save & next: Voice and Music
            </button>
          </div>
        </section>
      )}

      {step === 7 && (
        <section className="card">
          <h2>Add voice and music</h2>
          <p className="muted">
            Voice-over and music generation are coming in a future update — for now you can export the script below to add narration yourself.
            No music will be included; the render is silent (still images + animated text + motion only).
          </p>
          <div className="field">
            <label>Script export (from each scene's voice-over line)</label>
            <textarea className="field" rows={8} readOnly value={generatedCopy?.voiceOverScript || scenes.map(s => `Scene ${s.sceneNumber}: ${s.voiceOverLine || s.onScreenText}`).join("\n")} />
          </div>
          <p className="badge">No voice-over — export script only</p>
          <p className="badge">No music — export without music</p>
          <div className="actions">
            <button className="secondary" onClick={() => setStep(6)}>
              Back
            </button>
            <button className="primary" onClick={() => setStep(8)}>
              Next: Preview
            </button>
          </div>
        </section>
      )}

      {step === 8 && (
        <section className="card">
          <h2>Preview</h2>
          <div style={{ maxWidth: 360, margin: "0 auto" }}>
            {scenes.length > 0 && (
              <Player
                component={AdComposition}
                inputProps={{ product, scenes, brandKit }}
                durationInFrames={Math.max(30, Math.round(totalDuration * 30))}
                fps={30}
                compositionWidth={dims.width}
                compositionHeight={dims.height}
                style={{ width: "100%", aspectRatio: `${dims.width} / ${dims.height}` }}
                controls
              />
            )}
          </div>
          <div className="actions">
            <button className="secondary" onClick={() => setStep(7)}>
              Back
            </button>
            <button className="primary" onClick={() => setStep(9)}>
              Next: Render and export
            </button>
          </div>
        </section>
      )}

      {step === 9 && (
        <section className="card">
          <h2>Product-fact review</h2>
          <p className="muted">Review imported facts vs. generated on-screen text before rendering.</p>
          <h3>Imported facts</h3>
          <ul>
            {factReview.importedFacts.map(f => (
              <li key={f}>{f}</li>
            ))}
          </ul>
          {factReview.missingInfo.length > 0 && (
            <>
              <h3>Missing information</h3>
              <ul>
                {factReview.missingInfo.map(m => (
                  <li key={m}>{m}</li>
                ))}
              </ul>
            </>
          )}
          {factReview.flags.length > 0 ? (
            <>
              <h3>Potentially unsupported statements</h3>
              <ul>
                {factReview.flags.map((f, i) => (
                  <li key={i}>
                    Scene {scenes.find(s => s.id === f.sceneId)?.sceneNumber ?? "?"}: "{f.text}" — {f.reason}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>No unsupported claims detected.</p>
          )}
          {factReview.isAffiliate && <p className="badge">Affiliate disclosure will be shown on the CTA card and as on-screen text.</p>}
          {factReview.priceDisclaimerNeeded && <p className="muted">Price shown is current at time of ad creation and may change.</p>}

          <label style={{ display: "flex", gap: 8, alignItems: "center", marginTop: 16 }}>
            <input type="checkbox" checked={claimsApproved} onChange={e => setClaimsApproved(e.target.checked)} />
            I've reviewed and approved these claims
          </label>

          <h2 style={{ marginTop: 24 }}>Render and export</h2>
          <p className="muted">
            Format: {dims.label} · Duration: ~{totalDuration.toFixed(1)}s · Cost: $0 (local render, Phase 1)
          </p>
          <div className="actions">
            <button className="secondary" onClick={() => setStep(8)}>
              Back
            </button>
            <button className="primary" onClick={render} disabled={!claimsApproved || rendering}>
              {rendering ? "Rendering…" : "Render ad"}
            </button>
          </div>
          {renderStatus === "Complete" && exportUrl && (
            <p>
              Done! <a href={exportUrl} target="_blank" rel="noopener noreferrer">Download / preview MP4</a>
            </p>
          )}
          {renderStatus === "Failed" && <p className="status">Render failed — see error above.</p>}
        </section>
      )}
    </AppShell>
  );
}

export default function AdStudioNewPage() {
  return (
    <Suspense fallback={null}>
      <WizardInner />
    </Suspense>
  );
}
