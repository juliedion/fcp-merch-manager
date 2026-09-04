"use client";

import { useEffect, useMemo, useState } from "react";

function clean(s: string) { return s.replace(/\s+/g, " ").trim(); }
function copy(text: string) { if (text) void navigator.clipboard.writeText(text); }
const sleep = (ms: number) => new Promise(resolve => setTimeout(resolve, ms));

export default function SocialAdsPanel() {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [merchant, setMerchant] = useState("retailer");
  const [image, setImage] = useState("");
  const [videoBusy, setVideoBusy] = useState(false);
  const [videoStatus, setVideoStatus] = useState("");
  const [videoUrl, setVideoUrl] = useState("");\n  const [facebookBusy, setFacebookBusy] = useState(false);\n  const [facebookStatus, setFacebookStatus] = useState("");

  useEffect(() => {
    const scan = () => {
      const h1s = Array.from(document.querySelectorAll("h1"));
      const productTitle = h1s.map(x => clean(x.textContent || "")).find(x => x && !/^Paste a product/i.test(x)) || "";
      const detailsHeading = Array.from(document.querySelectorAll("h2")).find(x => /Product Details/i.test(x.textContent || ""));
      const productDetails = clean(detailsHeading?.parentElement?.querySelector("p")?.textContent || "");
      const buy = Array.from(document.querySelectorAll("a,button")).map(x => clean(x.textContent || "")).find(x => /^Buy (?:on|in) /i.test(x));
      const retailer = buy?.replace(/^Buy (?:on|in) /i, "").replace(/\s*→.*$/, "").trim() || "retailer";
      const ugc = document.querySelector('img[alt^="UGC creative"]') as HTMLImageElement | null;
      const original = document.querySelector('img[alt="Original product"]') as HTMLImageElement | null;
      setTitle(productTitle); setDetails(productDetails); setMerchant(retailer); setImage(ugc?.src || original?.src || "");
    };
    scan();
    const observer = new MutationObserver(scan);
    observer.observe(document.body, { subtree: true, childList: true, characterData: true, attributes: true, attributeFilter: ["src"] });
    return () => observer.disconnect();
  }, []);

  const ads = useMemo(() => {
    if (!title) return null;
    const fact = details.split(/[.!?]/).map(clean).find(x => x.length > 20) || `It is one of those smart little finds that makes everyday life easier.`;
    const benefit = fact.charAt(0).toLowerCase() + fact.slice(1);

    // FOMO here is intentionally curiosity/social-proof driven. Never invent stock levels,
    // deadlines, sales, popularity counts or price drops that the product data does not prove.
    const fb = `I almost scrolled past this — and now I get why people keep sharing finds like this. 👀\n\n${title}\n\nThe part that got me? ${fact}\n\nThis is exactly the kind of thing you see once, skip, and then wish you had saved when you actually need it. If ${benefit}, you’re going to want to see this one.\n\nI found it on ${merchant}. Tap through before you forget about it. 👇`;

    const ig = `STOP SCROLLING — this is one of those finds you’ll remember the second you need it. 👀\n\n${title}\n\nWhy it made the save list: ${fact}\n\nI would 100% rather know this exists now than go looking for a solution later. Save this, send it to the person who would immediately want one, or check it out on ${merchant} before you lose the post.\n\n#FortCrazypants #MustHaveFinds #ThingsYouNeed #SmartFinds #FoundIt #AmazonFinds`;

    const tt = `Wait… WHY did nobody show me this sooner? 👀\n\n${title}\n\n${fact}\n\nThis is your sign not to scroll and forget it exists. Save it now because the minute you actually need this, you’ll be trying to remember where you saw it. 😩\n\nFound on ${merchant} — tap to see it.\n\n#TikTokMadeMeBuyIt #ThingsYouNeed #MustHaveFinds #FortCrazypants #FoundOnTikTok`;

    const scenes = [
      `0–2s — PATTERN INTERRUPT: Tight product close-up. On-screen text: “WAIT — why did nobody show me this?”`,
      `2–5s — FOMO: Show the problem first. On-screen text: “You’re going to remember this the next time this happens…”`,
      `5–9s — REVEAL: Creator grabs ${title}. On-screen text: “THIS is what I should’ve had.”`,
      `9–14s — PROOF: Fast, satisfying demo of the real benefit. Let the product/result do the selling.`,
      `14–18s — REACTION: Creator looks genuinely impressed. On-screen text: “Okay… now I get it.”`,
      `18–22s — CTA: Product hero shot. On-screen text: “Save this before you forget it 👀” + “See it on ${merchant}.”`
    ];
    const voice = `Wait — if you deal with this, do not scroll yet. I found ${title}, and ${benefit}. This is one of those things you don’t think you need until the exact moment you REALLY need it. Watch this. [demo] Yeah… now I get it. Save this so you can actually find it again, or tap through to see it on ${merchant}.`;
    const videoPrompt = `Vertical 9:16 authentic high-retention UGC creator video for ${title}. Start from the supplied exact product image and keep the product visually faithful: same shape, color, proportions, controls, branding and materials. Strong first-second pattern interrupt, handheld smartphone aesthetic, natural home lighting, fast social-native cuts, genuine surprised reaction, creator naturally demonstrates the real product benefit. Create urgency through curiosity and fear of missing a useful discovery, not fake scarcity. Do not invent sales, limited stock, deadlines, popularity claims, product features, logos, text or accessories. Social ad style for Facebook Reels, Instagram Reels and TikTok.`;
    return { fb, ig, tt, scenes, voice, videoPrompt };
  }, [title, details, merchant]);

  async function createFacebookDraft() {
    if (!ads || !image || facebookBusy) return;
    setFacebookBusy(true); setFacebookStatus("Creating Facebook draft…");
    try {
      const r = await fetch("/api/social/post", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ platform: "facebook", mediaUrl: image, mediaType: "image", caption: ads.fb, mode: "draft" })
      });
      const d = await r.json();
      if (!r.ok) throw new Error(d.error || "Could not create Facebook draft.");
      setFacebookStatus("Draft created. Opening Meta Business Suite so you can edit it.");
      if (d.editUrl) window.open(d.editUrl, "_blank", "noopener,noreferrer");
    } catch (e) {
      setFacebookStatus(e instanceof Error ? e.message : "Could not create Facebook draft.");
    } finally {
      setFacebookBusy(false);
    }
  }

  async function generateReel() {
    if (!ads || !image || videoBusy) return;
    setVideoBusy(true); setVideoUrl(""); setVideoStatus("Starting vertical UGC reel…");
    try {
      const start = await fetch("/api/generate-video", { method:"POST", headers:{"Content-Type":"application/json"}, body:JSON.stringify({ promptText:ads.videoPrompt, promptImage:image, duration:5 }) });
      const started = await start.json();
      if (!start.ok) throw new Error(started.error || "Could not start reel generation.");
      for (let i=0;i<50;i++) {
        await sleep(3000);
        const r = await fetch(`/api/generate-video/${encodeURIComponent(started.taskId)}`, { cache:"no-store" });
        const d = await r.json();
        if (!r.ok) throw new Error(d.error || "Could not check reel status.");
        if (d.status === "SUCCEEDED" && d.videoUrl) { setVideoUrl(d.videoUrl); setVideoStatus("UGC reel clip ready for Facebook, Instagram and TikTok."); return; }
        if (d.status === "FAILED") throw new Error(d.error || "Reel generation failed.");
        setVideoStatus(`Generating reel… ${d.status === "RUNNING" ? "rendering" : "queued"}`);
      }
      throw new Error("Reel generation is taking longer than expected. Try again in a moment.");
    } catch(e) { setVideoStatus(e instanceof Error ? e.message : "Reel generation failed."); }
    finally { setVideoBusy(false); }
  }

  if (!ads) return null;
  const card: React.CSSProperties = { background:"#fff", border:"1px solid #e2dfd6", borderRadius:20, padding:24, margin:"0 0 22px", color:"#123b39", minWidth:0 };
  const grid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16 };
  const box: React.CSSProperties = { border:"1px solid #dfe4e1", borderRadius:14, padding:16, background:"#fafcfb", minWidth:0 };
  const button: React.CSSProperties = { border:0, borderRadius:10, padding:"10px 14px", background:"#073c3a", color:"#fff", fontWeight:800, cursor:"pointer", marginTop:10, minHeight:44 };

  return <section style={card}>
    <div style={{fontSize:13,letterSpacing:".14em",fontWeight:900,color:"#1b8d76"}}>SOCIAL ADS</div>
    <h2 style={{fontSize:27,margin:"4px 0 8px"}}>FOMO-first Facebook, Instagram & TikTok ad pack</h2>
    <p style={{margin:"0 0 18px",color:"#667673",lineHeight:1.5}}>Built to stop the scroll, create curiosity and make people feel like they’ll regret forgetting the find — without fake scarcity or made-up claims.</p>
    {image && <img src={image} alt="Selected social ad creative" style={{width:"100%",maxWidth:360,aspectRatio:"4/5",objectFit:"cover",borderRadius:14,border:"1px solid #ddd",marginBottom:18}}/>}
    <div style={grid}>
      <div style={box}><h3>Facebook Ad</h3><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.55,overflowWrap:"anywhere"}}>{ads.fb}</pre><div style={{display:"flex",gap:8,flexWrap:"wrap"}}><button style={button} onClick={()=>copy(ads.fb)}>Copy Facebook ad</button><button style={button} onClick={createFacebookDraft} disabled={facebookBusy || !image}>{facebookBusy ? "Creating draft…" : "Edit as Facebook draft"}</button></div>{facebookStatus && <p style={{fontSize:13,color:"#667673",lineHeight:1.45}}>{facebookStatus}</p>}</div>
      <div style={box}><h3>Instagram Caption</h3><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.55,overflowWrap:"anywhere"}}>{ads.ig}</pre><button style={button} onClick={()=>copy(ads.ig)}>Copy Instagram ad</button></div>
      <div style={box}><h3>TikTok Caption</h3><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.55,overflowWrap:"anywhere"}}>{ads.tt}</pre><button style={button} onClick={()=>copy(ads.tt)}>Copy TikTok ad</button></div>
    </div>
    <div style={{...box,marginTop:16}}><h3>9:16 FOMO UGC Reel — Facebook / Instagram / TikTok</h3><ol style={{paddingLeft:20,lineHeight:1.6}}>{ads.scenes.map((s,i)=><li key={i}>{s}</li>)}</ol><strong>Voiceover</strong><p style={{lineHeight:1.6}}>{ads.voice}</p><div style={{display:"flex",gap:10,flexWrap:"wrap"}}><button style={button} onClick={()=>copy(`${ads.scenes.join("\n")}\n\nVOICEOVER:\n${ads.voice}`)}>Copy reel script</button><button style={button} onClick={generateReel} disabled={videoBusy || !image}>{videoBusy ? "Generating reel…" : "Generate UGC reel video"}</button></div>{videoStatus && <p style={{fontSize:13,color:"#667673",overflowWrap:"anywhere"}}>{videoStatus}</p>}{videoUrl && <video src={videoUrl} controls playsInline style={{width:"100%",maxWidth:360,aspectRatio:"9/16",objectFit:"cover",borderRadius:14,marginTop:12,background:"#000"}}/>}</div>
    <button style={{...button,width:"100%",marginTop:18,padding:"14px 18px",fontSize:16}} onClick={()=>window.location.reload()}>Finish product & start next one</button>
  </section>;
}
