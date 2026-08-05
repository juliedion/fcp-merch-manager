import React from "react";
import { Composition, registerRoot } from "remotion";
import { AdComposition, AdCompositionProps } from "./AdComposition";
import { ASPECT_RATIOS, AspectRatio } from "@/lib/ad-studio-types";

const FPS = 30;
const DEFAULT_ASPECT: AspectRatio = "9:16";

function totalDurationInFrames(scenes: AdCompositionProps["scenes"]): number {
  const totalSeconds = scenes.reduce((sum, s) => sum + s.durationSeconds, 0) || 15;
  return Math.max(FPS, Math.round(totalSeconds * FPS));
}

/** Registered Remotion root. "AdVideo" is the composition id used both by the
 * in-browser <Player> preview (steps 5/8) and the server-side renderMedia() call in
 * app/api/ad-studio/render/route.ts. Dimensions and duration are computed from the
 * passed-in aspectRatio + scenes via calculateMetadata so both preview and render use
 * the exact same sizing logic. */
export function RemotionRoot() {
  return (
    <Composition
      id="AdVideo"
      component={AdComposition as unknown as React.FC<AdCompositionProps & { aspectRatio: AspectRatio }>}
      durationInFrames={FPS * 20}
      fps={FPS}
      width={1080}
      height={1920}
      defaultProps={{
        product: {
          source: "shopify",
          sourceId: "",
          title: "Sample Product",
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
        },
        scenes: [],
        brandKit: null,
        aspectRatio: DEFAULT_ASPECT
      }}
      calculateMetadata={async ({ props }) => {
        const aspectRatio = (props as any).aspectRatio as AspectRatio;
        const dims = ASPECT_RATIOS.find(a => a.id === aspectRatio) || ASPECT_RATIOS[0];
        return {
          durationInFrames: totalDurationInFrames((props as any).scenes || []),
          width: dims.width,
          height: dims.height
        };
      }}
    />
  );
}

registerRoot(RemotionRoot);
