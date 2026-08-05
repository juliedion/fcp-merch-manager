import type { CSSProperties } from "react";
import { MotionEffect } from "./ad-studio-types";

/**
 * Pure CSS-transform/filter math for each still-image motion effect, shared between
 * the Remotion render components and (indirectly) any future preview surface. Given
 * this effect, `progress` (0..1 through the scene), and the container size, returns
 * inline styles to apply to the <Img>.
 *
 * Simplifications (documented per spec):
 * - "parallax" -> combined pan + zoom (no true depth/layer separation).
 * - "product_spotlight" -> vignette + zoom-to-center (no subject detection).
 * - "foreground_background_separation" -> falls back to Ken Burns (no segmentation
 *   available in Phase 1); the container should also render a note badge in the editor.
 * - "masked_zoom" -> zoom with a rounded-rect/circle CSS clip-path mask.
 */

const ease = (t: number) => t * t * (3 - 2 * t); // smoothstep

export function getMotionImageStyle(effect: MotionEffect, progress: number): CSSProperties {
  const p = ease(Math.min(1, Math.max(0, progress)));
  const base: CSSProperties = { width: "100%", height: "100%", objectFit: "cover" };

  switch (effect) {
    case "push_in":
      return { ...base, transform: `scale(${1 + 0.15 * p})` };
    case "pull_out":
      return { ...base, transform: `scale(${1.15 - 0.15 * p})` };
    case "pan_left":
      return { ...base, transform: `scale(1.15) translateX(${8 - 16 * p}%)` };
    case "pan_right":
      return { ...base, transform: `scale(1.15) translateX(${-8 + 16 * p}%)` };
    case "pan_up":
      return { ...base, transform: `scale(1.15) translateY(${8 - 16 * p}%)` };
    case "pan_down":
      return { ...base, transform: `scale(1.15) translateY(${-8 + 16 * p}%)` };
    case "ken_burns":
      return { ...base, transform: `scale(${1.05 + 0.15 * p}) translate(${-3 + 6 * p}%, ${3 - 6 * p}%)` };
    case "parallax":
      // Simplified: same math as Ken Burns but slightly stronger zoom to fake depth.
      return { ...base, transform: `scale(${1.08 + 0.2 * p}) translate(${-4 + 8 * p}%, ${2 - 4 * p}%)` };
    case "slight_rotation":
      return { ...base, transform: `scale(1.1) rotate(${-2 + 4 * p}deg)` };
    case "product_spotlight":
      return { ...base, transform: `scale(${1.05 + 0.2 * p})`, transformOrigin: "center center" };
    case "background_blur":
      return { ...base, transform: `scale(${1.1 + 0.05 * p})`, filter: "blur(18px)" };
    case "foreground_background_separation":
      // Deferred/simplified fallback: identical to Ken Burns (see doc comment above).
      return { ...base, transform: `scale(${1.05 + 0.15 * p}) translate(${-3 + 6 * p}%, ${3 - 6 * p}%)` };
    case "masked_zoom":
      return { ...base, transform: `scale(${1 + 0.25 * p})` };
    case "split_screen":
      return { ...base, transform: `scale(${1 + 0.05 * p})` };
    case "none":
    default:
      return base;
  }
}

export function motionUsesVignette(effect: MotionEffect): boolean {
  return effect === "product_spotlight";
}

export function motionUsesMask(effect: MotionEffect): "circle" | "rounded" | null {
  if (effect === "masked_zoom") return "rounded";
  return null;
}
