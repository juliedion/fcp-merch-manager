import React from "react";
import { AbsoluteFill, Sequence, useVideoConfig } from "remotion";
import { MotionImage } from "./MotionImage";
import { BenefitCallout, CtaCard, DisclosureOverlay, LogoAnimation, PriceCallout, SceneTransitionWrapper, TextOverlay, TitleCard } from "./Overlays";
import { AdProductSnapshot, AdScene, BrandKit } from "@/lib/ad-studio-types";
import { DEFAULT_DISCLOSURE_TEXT, shouldShowAffiliateDisclosure } from "@/lib/ad-studio-fact-check";

export type AdCompositionProps = {
  product: AdProductSnapshot;
  scenes: AdScene[];
  brandKit: BrandKit | null;
};

/** Full assembled ad: iterates scenes as consecutive Sequences, each rendering the
 * right scene "card" type (product image w/ motion, title card, or CTA card) plus
 * shared overlays (text, benefit callout, price, logo, disclosure). Used both by the
 * in-browser Remotion Player preview (steps 5 and 8) and the server render route. */
export function AdComposition({ product, scenes, brandKit }: AdCompositionProps) {
  const { fps } = useVideoConfig();
  const showDisclosure = shouldShowAffiliateDisclosure(product);
  const disclosureText = brandKit?.default_disclosure_text || DEFAULT_DISCLOSURE_TEXT;

  let startFrame = 0;
  const items = scenes.map((scene, index) => {
    const durationInFrames = Math.max(1, Math.round(scene.durationSeconds * fps));
    const from = startFrame;
    startFrame += durationInFrames;
    return { scene, index, from, durationInFrames };
  });

  return (
    <AbsoluteFill style={{ background: "#000" }}>
      {items.map(({ scene, index, from, durationInFrames }) => (
        <Sequence key={scene.id} from={from} durationInFrames={durationInFrames}>
          <SceneTransitionWrapper durationInFrames={durationInFrames} transition={index === 0 ? "fade" : index % 2 === 0 ? "fade" : "slide"}>
            <AbsoluteFill>
              {scene.recommendedSource === "title_card" ? (
                <TitleCard title={scene.onScreenText || product.title} brandKit={brandKit} />
              ) : scene.recommendedSource === "cta_card" ? (
                <CtaCard
                  ctaText={scene.onScreenText}
                  disclosureText={disclosureText}
                  showDisclosure={showDisclosure}
                  brandKit={brandKit}
                  productTitle={product.title}
                  price={product.price}
                />
              ) : (
                <>
                  <MotionImage src={scene.productImageUrl} secondarySrc={scene.secondaryImageUrl} durationInFrames={durationInFrames} effect={scene.motionEffect} />
                  <TextOverlay text={scene.onScreenText} primaryColor={brandKit?.primary_color || "#063f42"} />
                  {index === 1 && product.benefits[0] && <BenefitCallout text={product.benefits[0]} primaryColor={brandKit?.primary_color || "#063f42"} />}
                  {index === items.length - 2 && <PriceCallout price={product.price} compareAtPrice={product.compareAtPrice} primaryColor={brandKit?.primary_color || "#063f42"} />}
                  {showDisclosure && <DisclosureOverlay text={disclosureText} />}
                  {brandKit?.watermark_all_scenes && brandKit.logo_url && <LogoAnimation logoUrl={brandKit.logo_url} />}
                </>
              )}
            </AbsoluteFill>
          </SceneTransitionWrapper>
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
