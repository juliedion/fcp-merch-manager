import React from "react";
import { AbsoluteFill, Img, useCurrentFrame } from "remotion";
import { getMotionImageStyle, motionUsesMask, motionUsesVignette } from "@/lib/ad-studio-motion";
import { MotionEffect } from "@/lib/ad-studio-types";

/** Renders a single still image with the chosen Phase 1 motion effect applied over
 * the scene's duration. See lib/ad-studio-motion.ts for the effect math and notes on
 * which effects are simplified (parallax, product_spotlight, foreground/background
 * separation, masked_zoom). */
export function MotionImage({ src, durationInFrames, effect, secondarySrc }: { src: string | null; durationInFrames: number; effect: MotionEffect; secondarySrc?: string | null }) {
  const frame = useCurrentFrame();
  const progress = durationInFrames > 0 ? frame / durationInFrames : 0;

  if (effect === "split_screen" && secondarySrc) {
    return (
      <AbsoluteFill style={{ flexDirection: "row" }}>
        <div style={{ width: "50%", height: "100%", overflow: "hidden" }}>{src && <Img src={src} style={getMotionImageStyle(effect, progress)} />}</div>
        <div style={{ width: "50%", height: "100%", overflow: "hidden", borderLeft: "2px solid rgba(255,255,255,0.6)" }}>{secondarySrc && <Img src={secondarySrc} style={getMotionImageStyle(effect, progress)} />}</div>
      </AbsoluteFill>
    );
  }

  const mask = motionUsesMask(effect);
  const clipPath = mask === "rounded" ? "inset(8% round 32px)" : mask === "circle" ? "circle(45% at 50% 50%)" : undefined;

  return (
    <AbsoluteFill style={{ overflow: "hidden", clipPath }}>
      {src ? <Img src={src} style={getMotionImageStyle(effect, progress)} /> : <AbsoluteFill style={{ background: "#0c2a2c" }} />}
      {motionUsesVignette(effect) && (
        <AbsoluteFill style={{ background: "radial-gradient(circle at center, rgba(0,0,0,0) 40%, rgba(0,0,0,0.55) 100%)" }} />
      )}
    </AbsoluteFill>
  );
}
