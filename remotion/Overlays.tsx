import React from "react";
import { AbsoluteFill, Img, interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import { BrandKit } from "@/lib/ad-studio-types";

/** Animated hook / on-screen text overlay. Simple fade + slight rise-in, kept inside
 * the safe area (avoids extreme edges where platform UI usually sits). */
export function TextOverlay({ text, primaryColor }: { text: string; primaryColor: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, fps * 0.4], [0, 1], { extrapolateRight: "clamp" });
  const translateY = interpolate(frame, [0, fps * 0.4], [16, 0], { extrapolateRight: "clamp" });
  if (!text) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 8% 14%" }}>
      <div
        style={{
          opacity,
          transform: `translateY(${translateY}px)`,
          background: "rgba(6,63,66,0.55)",
          color: "#fff",
          padding: "18px 24px",
          borderRadius: 16,
          fontSize: 40,
          fontWeight: 700,
          textAlign: "center",
          maxWidth: "84%",
          lineHeight: 1.2,
          border: `3px solid ${primaryColor}`
        }}
      >
        {text}
      </div>
    </AbsoluteFill>
  );
}

export function BenefitCallout({ text, primaryColor }: { text: string; primaryColor: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14 } });
  if (!text) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start", padding: "10% 6%" }}>
      <div
        style={{
          transform: `scale(${scale})`,
          background: primaryColor,
          color: "#fff",
          padding: "10px 18px",
          borderRadius: 999,
          fontSize: 28,
          fontWeight: 600
        }}
      >
        ✓ {text}
      </div>
    </AbsoluteFill>
  );
}

export function PriceCallout({ price, compareAtPrice, primaryColor }: { price: number; compareAtPrice: number | null; primaryColor: string }) {
  if (!price) return null;
  const hasDiscount = compareAtPrice && compareAtPrice > price;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-end", padding: "10% 6%" }}>
      <div style={{ background: "#fff", color: primaryColor, padding: "10px 18px", borderRadius: 14, fontSize: 32, fontWeight: 800, display: "flex", gap: 10, alignItems: "baseline" }}>
        <span>${price.toFixed(2)}</span>
        {hasDiscount && <span style={{ fontSize: 20, color: "#999", textDecoration: "line-through" }}>${compareAtPrice!.toFixed(2)}</span>}
      </div>
    </AbsoluteFill>
  );
}

export function DiscountBadge({ price, compareAtPrice }: { price: number; compareAtPrice: number | null }) {
  if (!compareAtPrice || compareAtPrice <= price) return null;
  const pct = Math.round((1 - price / compareAtPrice) * 100);
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "flex-start", padding: "4% 6%" }}>
      <div style={{ background: "#ff6b6b", color: "#fff", padding: "8px 16px", borderRadius: 999, fontSize: 26, fontWeight: 800, transform: "rotate(-4deg)" }}>
        {pct}% OFF
      </div>
    </AbsoluteFill>
  );
}

export function DisclosureOverlay({ text }: { text: string }) {
  if (!text) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-end", alignItems: "center", padding: "0 6% 2%" }}>
      <div style={{ fontSize: 16, color: "rgba(255,255,255,0.85)", textAlign: "center" }}>{text}</div>
    </AbsoluteFill>
  );
}

export function LogoAnimation({ logoUrl }: { logoUrl: string }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 12 } });
  const opacity = interpolate(frame, [0, fps * 0.3], [0, 1], { extrapolateRight: "clamp" });
  if (!logoUrl) return null;
  return (
    <AbsoluteFill style={{ justifyContent: "flex-start", alignItems: "center", padding: "6% 0 0" }}>
      <Img src={logoUrl} style={{ width: 140, height: 140, objectFit: "contain", opacity, transform: `scale(${scale})` }} />
    </AbsoluteFill>
  );
}

export function TitleCard({ title, brandKit }: { title: string; brandKit: BrandKit | null }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const opacity = interpolate(frame, [0, fps * 0.5], [0, 1], { extrapolateRight: "clamp" });
  const primary = brandKit?.primary_color || "#063f42";
  return (
    <AbsoluteFill style={{ background: primary, justifyContent: "center", alignItems: "center", padding: "0 10%" }}>
      <div style={{ opacity, color: "#fff", fontSize: 56, fontWeight: 800, textAlign: "center", lineHeight: 1.15 }}>{title}</div>
    </AbsoluteFill>
  );
}

export function CtaCard({
  ctaText,
  disclosureText,
  showDisclosure,
  brandKit,
  productTitle,
  price
}: {
  ctaText: string;
  disclosureText: string;
  showDisclosure: boolean;
  brandKit: BrandKit | null;
  productTitle: string;
  price: number;
}) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const scale = spring({ frame, fps, config: { damping: 14 } });
  const primary = brandKit?.primary_color || "#063f42";
  const secondary = brandKit?.secondary_color || "#ff6b6b";
  return (
    <AbsoluteFill style={{ background: primary, justifyContent: "center", alignItems: "center", flexDirection: "column", gap: 24, padding: "0 8%" }}>
      {brandKit?.logo_url && <Img src={brandKit.logo_url} style={{ width: 110, height: 110, objectFit: "contain" }} />}
      <div style={{ color: "#fff", fontSize: 40, fontWeight: 700, textAlign: "center" }}>{productTitle}</div>
      {price > 0 && <div style={{ color: "#fff", fontSize: 30 }}>${price.toFixed(2)}</div>}
      <div style={{ transform: `scale(${scale})`, background: secondary, color: "#fff", padding: "16px 36px", borderRadius: 999, fontSize: 32, fontWeight: 800 }}>
        {ctaText || brandKit?.default_cta_text || "Shop Now"}
      </div>
      {showDisclosure && <div style={{ color: "rgba(255,255,255,0.85)", fontSize: 16, textAlign: "center", maxWidth: "80%" }}>{disclosureText}</div>}
    </AbsoluteFill>
  );
}

/** Basic cut/fade/slide transition wrapper applied per-scene at its boundaries. */
export function SceneTransitionWrapper({ children, durationInFrames, transition }: { children: React.ReactNode; durationInFrames: number; transition: "cut" | "fade" | "slide" }) {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const transitionFrames = Math.min(Math.round(fps * 0.35), Math.floor(durationInFrames / 4));

  if (transition === "cut" || transitionFrames <= 0) return <>{children}</>;

  if (transition === "fade") {
    const opacity = interpolate(
      frame,
      [0, transitionFrames, durationInFrames - transitionFrames, durationInFrames],
      [0, 1, 1, 0],
      { extrapolateLeft: "clamp", extrapolateRight: "clamp" }
    );
    return <AbsoluteFill style={{ opacity }}>{children}</AbsoluteFill>;
  }

  // slide
  const translateX = interpolate(frame, [0, transitionFrames], [100, 0], { extrapolateRight: "clamp" });
  return <AbsoluteFill style={{ transform: `translateX(${translateX}%)` }}>{children}</AbsoluteFill>;
}
