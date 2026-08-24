"use client";

import { useEffect, useMemo, useState } from "react";
import type { GeneratedProduct, ProductInput } from "@/lib/types";
import styles from "./MerchManagerV2.module.css";

const emptyInput: ProductInput = {
  url: "", name: "", cost: 0, price: 0, category: "", audience: "", problem: "", features: "",
  shippingDays: 7, competition: "medium", demoFactor: 6, productType: "dropshipping", amazonUrl: "",
  affiliateUrl: "", isAffiliateProduct: false, merchant: "", affiliateNetwork: "", vendor: "Fort Crazypants",
  compareAtPrice: 0, fcpVerdict: "", sourceDescription: ""
};

const COLLECTION_OPTIONS = ["Best Sellers","Back to School","End of Summer Blowout","Fall Finds","Halloween","Home, Kitchen, Decor & More","Gift-worthy Finds","Boredom Busters","Hot Mama Finds","Home Office & Workday Wins","Sports Parent & Sideline Finds","Baby, Kids & Littles","Teens & Tweens","Travel Finds","Craft & Hobby","Personal Care","Garden & Outdoor","Organization Finds","Hot Romance & Couples","Man Caves, Garages & Grills","Fitness & Sports","Hot Toys","Apparel & Accessories","Electronics, Cameras & More","Dads & Dudes"];

const UGC_PROMPTS = [
  "Casual iPhone-style UGC photo of a real person naturally using this exact product at home. Authentic creator content, imperfect everyday composition, natural daylight, believable environment, no ad text.",
  "Realistic UGC unboxing photo of this exact product held in two hands near its packaging on a kitchen or bathroom counter. Candid smartphone photography, natural light, relatable home setting.",
  "Lifestyle UGC photo showing this exact product actively being used for its intended purpose. Real home, real person, casual social-media creator aesthetic, natural expression, no studio look.",
  "Close-up UGC detail shot of this exact product in a person's hand, clearly showing the real controls, materials and shape from the source photo. Smartphone camera, soft window light.",
  "Before-and-after style UGC scene with this exact product as the hero, photographed naturally in a lived-in home. Show the useful result without adding text overlays or changing the product.",
  "Bright morning-routine UGC photo featuring this exact product in use. Authentic creator aesthetic, casual clothing, natural skin texture, realistic home lighting, slightly imperfect phone framing.",
  "Social-media UGC flat-lay of this exact product with a few relevant everyday objects around it. Keep the product completely faithful to the reference image, clean but not overly styled.",
  "Candid UGC photo of someone smiling naturally while demonstrating this exact product. Realistic home background, smartphone photo, no influencer studio setup, product fully visible.",
  "Vertical Pinterest/Instagram-ready UGC lifestyle photo of this exact product being used naturally. Leave comfortable negative space while keeping the product recognizable and unchanged.",
  "Authentic review-style UGC product photo taken on a phone: this exact product placed in a real home immediately after use, believable clutter and natural lighting, high realism."
];

function htmlText(html: string) {
  return (html || "").replace(/<br\s*\/?>/gi, "\n").replace(/<\/p>/gi, "\n").replace(/<\/li>/gi, "\n")
    .replace(/<[^>]+>/g, " ").replace(/&amp;/g, "&").replace(/&quot;/g, '"').replace(/&#39;/g, "'")
    .replace(/[ \t]{2,}/g, " ").replace(/\n{3,}/g, "\n\n").trim();
}

function firstThreeLines(result: GeneratedProduct) {
  const candidates = [...(result.benefits || []), ...(result.bullets || [])].filter(Boolean);
  return candidates.slice(0, 3).map(x => x.replace(/[.;,:\s]+$/, "") + ".").join(" ");
}

export default function MerchManagerV2() {
  const [url, setUrl] = useState("");
  const [input, setInput] = useState<ProductInput>(emptyInput);
  const [result, setResult] = useState<GeneratedProduct | null>(null);
  const [sourceImages, setSourceImages] = useState<string[]>([]);
  const [ugcImages, setUgcImages] = useState<string[]>([]);
  const [selectedImage, setSelectedImage] = useState(0);
  const [ugcCount, setUgcCount] = useState(5);
  const [status, setStatus] = useState("");
  const [researching, setResearching] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [ugcBusy, setUgcBusy] = useState(false);
  const [customImageBusy, setCustomImageBusy] = useState(false);
  const [customImagePrompt, setCustomImagePrompt] = useState("");
  const [publishing, setPublishing] = useState(false);
  const [socialCaption, setSocialCaption] = useState("");
  const [pinterestTitle, setPinterestTitle] = useState("");
  const [pinterestDescription, setPinterestDescription] = useState("");
  const [selectedCollections, setSelectedCollections] = useState<string[]>([]);
  const [customCollection, setCustomCollection] = useState("");

  const allImages = useMemo(() => [...ugcImages, ...sourceImages].filter((x, i, a) => x && a.indexOf(x) === i), [ugcImages, sourceImages]);
  const previewImage = allImages[selectedImage] || sourceImages[0] || "";
  const productDetails = result ? htmlText(result.descriptionHtml) : input.sourceDescription;
  const whyLove = result ? firstThreeLines(result) : "";

  function toggleCollection(name: string) { setSelectedCollections(current => current.includes(name) ? current.filter(x => x !== name) : [...current, name]); }
  function addCustomCollection() { const name = customCollection.trim(); if (!name) return; setSelectedCollections(current => current.includes(name) ? current : [...current, name]); setCustomCollection(""); }

  async function generateListing(nextInput: ProductInput, images = sourceImages, autoUgc = false) {
    if (!nextInput.name.trim()) { setStatus("The product title could not be read from the listing."); return; }
    if (!nextInput.price || nextInput.price <= 0) { setInput(nextInput); setStatus("The price could not be read. Enter the current product price below, then click Generate listing."); return; }
    setGenerating(true);
    try {
      const r = await fetch("/api/generate", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(nextInput) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not generate the listing.");
      const generated = d as GeneratedProduct; setResult(generated); setSelectedCollections(Array.from(new Set(generated.collections || [])));
      setSocialCaption(generated.instagramCaption || generated.facebookPost || generated.metaDescription || ""); setPinterestTitle(generated.pinterestTitle || generated.title); setPinterestDescription(generated.pinterestDescription || generated.metaDescription || "");
      setStatus("Product information and AI copy are ready. Generating UGC product images…");
      if (autoUgc && images.length) void generateUgcPack(generated, images, ugcCount); else setStatus("Product information and AI copy are ready.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Generation failed."); } finally { setGenerating(false); }
  }

  async function researchProduct(target: string) {
    const trimmed = target.trim(); if (!/^https?:\/\//i.test(trimmed)) return;
    setResearching(true); setResult(null); setUgcImages([]); setSelectedImage(0); setSelectedCollections([]); setStatus("Reading the exact product listing…");
    try {
      const r = await fetch("/api/scrape", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ url: trimmed }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Could not read that product page.");
      const nextInput = d.input as ProductInput; const images = (d.scraped?.images || []) as string[]; setInput(nextInput); setSourceImages(images);
      if (!images.length) setStatus("Product information was found, but the source site did not expose its product gallery."); await generateListing(nextInput, images, true);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Could not read that product page."); } finally { setResearching(false); }
  }

  useEffect(() => { const trimmed = url.trim(); if (!/^https?:\/\//i.test(trimmed)) return; const t = setTimeout(() => void researchProduct(trimmed), 700); return () => clearTimeout(t); }, [url]); // eslint-disable-line react-hooks/exhaustive-deps

  async function hostGeneratedImage(imageUrl: string, index: number) {
    if (!imageUrl.startsWith("data:image/")) return imageUrl;
    try { const r = await fetch("/api/shopify/upload-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ dataUrl: imageUrl, filename: `ugc-${Date.now()}-${index + 1}.png` }) }); const d = await r.json(); return r.ok && d.imageUrl ? String(d.imageUrl) : imageUrl; } catch { return imageUrl; }
  }

  async function generateUgcPack(product = result, images = sourceImages, count = ugcCount) {
    if (!product || !images.length || ugcBusy) return; setUgcBusy(true); setUgcImages([]); setSelectedImage(0);
    try {
      for (let i = 0; i < count; i++) {
        setStatus(`Generating UGC image ${i + 1} of ${count} from the original product photography…`);
        const sourceImageUrl = images[i % Math.min(images.length, 4)]; const prompt = `${UGC_PROMPTS[i % UGC_PROMPTS.length]} Product: ${product.title}. Product facts: ${htmlText(product.descriptionHtml).slice(0, 900)}`;
        const r = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, sourceImageUrl, aspectRatio: i % 3 === 0 ? "4:5" : "1:1", negativePrompt: "wrong product, altered product, fake controls, invented accessories, text, watermark, logo changes, distorted hands" }) });
        const d = await r.json(); if (!r.ok) throw new Error(d.error || `UGC image ${i + 1} failed.`); const hosted = await hostGeneratedImage(d.imageUrl, i); setUgcImages(prev => [...prev, hosted]);
      }
      setStatus(`${count} UGC images are ready and attached to this product package.`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "UGC generation failed."); } finally { setUgcBusy(false); }
  }

  async function generateCustomImage() {
    const request = customImagePrompt.trim();
    if (!result || !request || !sourceImages.length || customImageBusy) return;
    setCustomImageBusy(true); setStatus("Generating your custom product image from the original listing photo…");
    try {
      const sourceImageUrl = sourceImages[0];
      const prompt = `${request}\n\nIMPORTANT: Use the attached/source product photo as the exact product reference. Keep the product's shape, colors, controls, branding, proportions and recognizable details faithful to the original. Product: ${result.title}. Product facts: ${htmlText(result.descriptionHtml).slice(0, 900)}. Create a polished, realistic UGC/lifestyle image unless the request specifies another style.`;
      const r = await fetch("/api/generate-image", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ prompt, sourceImageUrl, aspectRatio: "4:5", negativePrompt: "wrong product, altered product, fake controls, invented accessories, incorrect branding, misspelled text, watermark, distorted hands" }) });
      const d = await r.json(); if (!r.ok) throw new Error(d.error || "Custom image generation failed.");
      const hosted = await hostGeneratedImage(d.imageUrl, ugcImages.length); setUgcImages(prev => [hosted, ...prev]); setSelectedImage(0); setStatus("Your custom AI product image is ready and added to the UGC gallery.");
    } catch (e) { setStatus(e instanceof Error ? e.message : "Custom image generation failed."); } finally { setCustomImageBusy(false); }
  }

  async function publish() {
    if (!result) return; setPublishing(true); setStatus("Publishing Shopify draft…");
    try {
      const hostedUgc = ugcImages.filter(x => /^https?:\/\//i.test(x)); const images = [...hostedUgc, ...sourceImages].filter((x, i, a) => /^https?:\/\//i.test(x) && a.indexOf(x) === i).slice(0, 10);
      const r = await fetch("/api/shopify/publish", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ ...result, collections: selectedCollections, fcpVerdict: "", images }) });
      const d = await r.json(); if (!r.ok) throw new Error(typeof d.error === "string" ? d.error : JSON.stringify(d.error)); const collectionNote = d.collectionsAdded?.length ? ` — added to ${d.collectionsAdded.join(", ")}` : selectedCollections.length ? " — no matching Shopify collections were found" : "";
      setStatus(`Draft created in Shopify: ${d.title}${d.imagesAttached ? ` — ${d.imagesAttached} images attached` : ""}${collectionNote}.`);
    } catch (e) { setStatus(e instanceof Error ? e.message : "Publish failed."); } finally { setPublishing(false); }
  }

  async function postPinterest() {
    if (!result || !previewImage) return; setStatus("Posting pin…");
    try { const r = await fetch("/api/social/pinterest", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ title: pinterestTitle, description: pinterestDescription, imageUrl: previewImage, link: result.ctaButtonUrl || input.url }) }); const d = await r.json(); if (!r.ok) throw new Error(d.error || "Pinterest posting failed."); setStatus("Posted to Pinterest."); } catch (e) { setStatus(e instanceof Error ? e.message : "Pinterest posting failed."); }
  }

  return <div className={styles.wrap}>
    <header className={styles.header}><div className={styles.kicker}>FCP MERCH MANAGER</div><h1>Paste a product. Build the real listing.</h1><p>Pull the original product data, rewrite the copy, create UGC assets, preview the exact product page, and publish.</p></header>
    <section className={styles.card}><label className={styles.label}>Product URL</label><div className={styles.urlRow}><input value={url} onChange={e => setUrl(e.target.value)} placeholder="Paste Amazon, Mavely, Walmart, supplier or product URL"/><button onClick={() => researchProduct(url)} disabled={researching}>{researching ? "Reading…" : "Pull product"}</button></div>{status && <div className={styles.status}>{status}</div>}</section>

    {(input.name || sourceImages.length > 0) && <section className={styles.card}>
      <div className={styles.sectionHead}><div><div className={styles.kicker}>ORIGINAL LISTING DATA</div><h2>Product information</h2></div></div>
      <div className={styles.formGrid}><label><span>Product title</span><input value={input.name} onChange={e => setInput(v => ({ ...v, name: e.target.value }))}/></label><label><span>Price</span><input type="number" step="0.01" value={input.price || ""} onChange={e => setInput(v => ({ ...v, price: Number(e.target.value) }))} placeholder="Current price"/></label><label><span>Category</span><input value={input.category} onChange={e => setInput(v => ({ ...v, category: e.target.value }))}/></label><label><span>Merchant</span><input value={input.merchant} onChange={e => setInput(v => ({ ...v, merchant: e.target.value }))}/></label></div>
      {sourceImages.length > 0 && <div className={styles.sourceStrip}>{sourceImages.map((src, i) => <img key={`${src}-${i}`} src={src} alt="Original product"/>)}</div>}
      <details className={styles.sourceCopy}><summary>Original product description</summary><p>{input.sourceDescription}</p></details><button className={styles.primary} onClick={() => generateListing(input)} disabled={generating}>{generating ? "Writing…" : "Regenerate AI listing"}</button>
    </section>}

    {result && <>
      <section className={styles.card}><div className={styles.sectionHead}><div><div className={styles.kicker}>SHOPIFY COLLECTIONS</div><h2>Where should this product appear?</h2></div></div><p className={styles.note}>Choose every collection this product belongs in. These selections override the AI suggestions when you publish the Shopify draft.</p><div style={{display:"grid",gridTemplateColumns:"repeat(auto-fit,minmax(220px,1fr))",gap:"10px",marginTop:"16px"}}>{COLLECTION_OPTIONS.map(name => <label key={name} style={{display:"flex",alignItems:"center",gap:"10px",padding:"10px 12px",border:"1px solid #d9dedb",borderRadius:"10px",background:selectedCollections.includes(name)?"#eef8f5":"#fff",cursor:"pointer"}}><input type="checkbox" checked={selectedCollections.includes(name)} onChange={() => toggleCollection(name)}/><span>{name}</span></label>)}</div><div style={{display:"flex",gap:"10px",marginTop:"16px",flexWrap:"wrap"}}><input style={{flex:"1 1 260px"}} value={customCollection} onChange={e => setCustomCollection(e.target.value)} onKeyDown={e => { if (e.key === "Enter") { e.preventDefault(); addCustomCollection(); } }} placeholder="Add another Shopify collection"/><button onClick={addCustomCollection}>Add collection</button></div>{selectedCollections.length > 0 && <div style={{display:"flex",gap:"8px",flexWrap:"wrap",marginTop:"14px"}}>{selectedCollections.map(name => <button key={name} onClick={() => toggleCollection(name)} title="Remove collection" style={{border:"1px solid #cfe2dc",borderRadius:"999px",padding:"7px 11px",background:"#f2faf7",cursor:"pointer"}}>{name} ×</button>)}</div>}</section>

      <section className={styles.card}><div className={styles.sectionHead}><div><div className={styles.kicker}>EXACT STOREFRONT PREVIEW</div><h2>Product page</h2></div><button className={styles.primary} onClick={publish} disabled={publishing}>{publishing ? "Publishing…" : "Publish draft"}</button></div><div className={styles.productPage}><div className={styles.gallery}><div className={styles.mainImage}>{previewImage ? <img src={previewImage} alt={result.title}/> : <div>No product image</div>}</div><div className={styles.thumbRail}>{allImages.map((src, i) => <button key={`${src}-${i}`} className={i === selectedImage ? styles.activeThumb : ""} onClick={() => setSelectedImage(i)}><img src={src} alt=""/></button>)}</div></div><div className={styles.productCopy}><div className={styles.productEyebrow}>{(result.category || "FORT CRAZYPANTS FIND").toUpperCase()}</div><h1>{result.title}</h1><div className={styles.price}>${Number(result.price).toFixed(2)}</div>{result.ctaButtonText && <a className={styles.buyButton} href={result.ctaButtonUrl || "#"} target="_blank" rel="nofollow sponsored noopener">{result.ctaButtonText} →</a>}{result.disclosureText && <p className={styles.disclosure}>{result.disclosureText}</p>}<section className={styles.productDetails}><h2>Product Details</h2><p>{productDetails}</p></section>{result.bullets?.length > 0 && <ul className={styles.featureBullets}>{result.bullets.slice(0, 6).map((x, i) => <li key={i}>{x.replace(/[.;,:\s]+$/, "") + "."}</li>)}</ul>}<section className={styles.why}><h2>Why You&apos;ll Love It</h2><p>{whyLove}</p></section></div></div></section>

      <section className={styles.card}>
        <div className={styles.sectionHead}><div><div className={styles.kicker}>AI UGC IMAGE GALLERY</div><h2>Creator-style product images</h2></div><div className={styles.ugcControls}><select value={ugcCount} onChange={e => setUgcCount(Number(e.target.value))}>{[5,6,7,8,9,10].map(n => <option key={n} value={n}>{n} images</option>)}</select><button className={styles.primary} onClick={() => generateUgcPack()} disabled={ugcBusy}>{ugcBusy ? "Generating…" : `Generate ${ugcCount} UGC images`}</button></div></div>
        <p className={styles.note}>Each image uses the original listing photography as the visual reference so the product stays recognizable instead of being reinvented by AI.</p>
        <div style={{margin:"18px 0",padding:"16px",border:"1px solid #d9dedb",borderRadius:"12px",background:"#fafcfb"}}><label className={styles.label}>Ask AI for a specific image</label><textarea rows={4} value={customImagePrompt} onChange={e => setCustomImagePrompt(e.target.value)} placeholder="Example: Show a mom using this product in a bright kitchen while her kids do homework in the background. Make it look like a candid iPhone photo for Instagram." style={{width:"100%",marginTop:"8px",padding:"12px",border:"1px solid #cfd7d3",borderRadius:"10px",font:"inherit",resize:"vertical"}}/><div style={{display:"flex",justifyContent:"space-between",gap:"12px",alignItems:"center",flexWrap:"wrap",marginTop:"10px"}}><span className={styles.note}>The original product photo will automatically be used as the visual reference.</span><button className={styles.primary} onClick={generateCustomImage} disabled={customImageBusy || !customImagePrompt.trim() || !sourceImages.length}>{customImageBusy ? "Generating custom image…" : "Generate this image"}</button></div></div>
        <div className={styles.ugcScroller}>{ugcImages.map((src, i) => <button key={`${src}-${i}`} onClick={() => setSelectedImage(i)}><img src={src} alt={`UGC creative ${i + 1}`}/></button>)}</div>
      </section>

      <section className={styles.card}><div className={styles.kicker}>SOCIAL CREATIVE</div><h2>Ready-to-post creative</h2><div className={styles.socialGrid}><div>{previewImage && <img className={styles.socialImage} src={previewImage} alt="Selected social creative"/>}<div className={styles.miniStrip}>{ugcImages.map((src, i) => <button key={`${src}-${i}`} onClick={() => setSelectedImage(i)}><img src={src} alt=""/></button>)}</div></div><label className={styles.caption}><span>AI caption</span><textarea rows={10} value={socialCaption} onChange={e => setSocialCaption(e.target.value)}/><button onClick={() => navigator.clipboard.writeText(socialCaption)}>Copy caption</button></label></div></section>

      <section className={styles.card}><div className={styles.kicker}>PINTEREST</div><h2>Create a Pin</h2><div className={styles.pinterestGrid}>{previewImage && <img src={previewImage} alt="Pinterest creative"/>}<div className={styles.pinFields}><label><span>Pin title</span><input value={pinterestTitle} onChange={e => setPinterestTitle(e.target.value)}/></label><label><span>Description</span><textarea rows={6} value={pinterestDescription} onChange={e => setPinterestDescription(e.target.value)}/></label><button className={styles.primary} onClick={postPinterest}>Post to Pinterest</button></div></div></section>
    </>}
  </div>;
}
