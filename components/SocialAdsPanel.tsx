"use client";

import { useEffect, useMemo, useState } from "react";

function clean(s: string) { return s.replace(/\s+/g, " ").trim(); }
function copy(text: string) { if (text) void navigator.clipboard.writeText(text); }

export default function SocialAdsPanel() {
  const [title, setTitle] = useState("");
  const [details, setDetails] = useState("");
  const [merchant, setMerchant] = useState("retailer");
  const [image, setImage] = useState("");

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
    const fact = details.split(/[.!?]/).map(clean).find(x => x.length > 20) || `A practical find designed to make everyday life easier.`;
    const hook = `Okay, this is one of those “where has this been?” finds.`;
    const fb = `${hook}\n\n${title} caught our attention because ${fact.charAt(0).toLowerCase()}${fact.slice(1)}.\n\nIf this solves a problem you deal with all the time, it is absolutely worth a look.\n\nShop it on ${merchant} →`;
    const ig = `${hook}\n\n${title} ✨\n${fact}\n\nWould you try this?\n\n#FortCrazypants #AmazonFinds #MustHave #FoundIt #SmartFinds`;
    const tt = `POV: you found the product you didn’t know you needed 👀\n\n${title}\n\n${fact}\n\nTap to check it out on ${merchant}.\n\n#TikTokMadeMeBuyIt #FoundOnTikTok #FortCrazypants #ProductFinds`;
    const scenes = [
      `0–2s — HOOK: Close-up of the product. On-screen text: “Wait… why is this actually genius?”`,
      `2–5s — PROBLEM: Show the everyday frustration this product helps with.`,
      `5–9s — REVEAL: Creator picks up ${title} and starts using it naturally.`,
      `9–14s — DEMO: Tight shots of the most useful feature/result. Keep cuts fast and phone-shot, not polished studio footage.`,
      `14–18s — REACTION: Natural creator reaction. On-screen text: “Okay, I get the hype.”`,
      `18–22s — CTA: Product hero shot + “See it on ${merchant}” / “Tap to shop.”`
    ];
    const voice = `${hook} I found ${title}, and ${fact.charAt(0).toLowerCase()}${fact.slice(1)}. Watch this. [demo] Okay, I get the hype. If you want to check it out, tap through to ${merchant}.`;
    return { fb, ig, tt, scenes, voice };
  }, [title, details, merchant]);

  if (!ads) return null;
  const card: React.CSSProperties = { background:"#fff", border:"1px solid #e2dfd6", borderRadius:20, padding:24, margin:"0 0 22px", color:"#123b39" };
  const grid: React.CSSProperties = { display:"grid", gridTemplateColumns:"repeat(auto-fit,minmax(260px,1fr))", gap:16 };
  const box: React.CSSProperties = { border:"1px solid #dfe4e1", borderRadius:14, padding:16, background:"#fafcfb", minWidth:0 };
  const button: React.CSSProperties = { border:0, borderRadius:10, padding:"10px 14px", background:"#073c3a", color:"#fff", fontWeight:800, cursor:"pointer", marginTop:10 };

  return <section style={card}>
    <div style={{fontSize:13,letterSpacing:".14em",fontWeight:900,color:"#1b8d76"}}>SOCIAL ADS</div>
    <h2 style={{fontSize:27,margin:"4px 0 8px"}}>Facebook, Instagram & TikTok ad pack</h2>
    <p style={{margin:"0 0 18px",color:"#667673",lineHeight:1.5}}>Generated from the current product page. The reel is written for vertical 9:16 UGC creative and can use the AI UGC image gallery as the visual reference.</p>
    {image && <img src={image} alt="Selected social ad creative" style={{width:"100%",maxWidth:360,aspectRatio:"4/5",objectFit:"cover",borderRadius:14,border:"1px solid #ddd",marginBottom:18}}/>}
    <div style={grid}>
      <div style={box}><h3>Facebook / Instagram Ad</h3><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.55}}>{ads.fb}</pre><button style={button} onClick={()=>copy(ads.fb)}>Copy Facebook ad</button></div>
      <div style={box}><h3>Instagram Caption</h3><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.55}}>{ads.ig}</pre><button style={button} onClick={()=>copy(ads.ig)}>Copy Instagram ad</button></div>
      <div style={box}><h3>TikTok Caption</h3><pre style={{whiteSpace:"pre-wrap",fontFamily:"inherit",lineHeight:1.55}}>{ads.tt}</pre><button style={button} onClick={()=>copy(ads.tt)}>Copy TikTok ad</button></div>
    </div>
    <div style={{...box,marginTop:16}}><h3>9:16 UGC Reel — Facebook / Instagram / TikTok</h3><ol style={{paddingLeft:20,lineHeight:1.6}}>{ads.scenes.map((s,i)=><li key={i}>{s}</li>)}</ol><strong>Voiceover</strong><p style={{lineHeight:1.6}}>{ads.voice}</p><button style={button} onClick={()=>copy(`${ads.scenes.join("\n")}\n\nVOICEOVER:\n${ads.voice}`)}>Copy reel script</button></div>
    <button style={{...button,width:"100%",marginTop:18,padding:"14px 18px",fontSize:16}} onClick={()=>window.location.reload()}>Finish product & start next one</button>
  </section>;
}
