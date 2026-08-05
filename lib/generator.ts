import { GeneratedProduct, ProductInput } from "./types";

const slugify = (value: string) => value.toLowerCase().trim().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const clamp = (n: number, min = 0, max = 100) => Math.min(max, Math.max(min, n));

export function scoreProduct(input: ProductInput) {
  const margin = input.price > 0 ? ((input.price - input.cost) / input.price) * 100 : 0;
  const marginScore = clamp((margin - 20) * 1.5, 0, 30);
  const demoScore = clamp(input.demoFactor, 1, 10) * 3;
  const competitionScore = input.competition === "low" ? 18 : input.competition === "medium" ? 10 : 3;
  const shippingScore = input.shippingDays <= 7 ? 12 : input.shippingDays <= 12 ? 8 : input.shippingDays <= 20 ? 4 : 0;
  const problemScore = input.problem.trim().length > 12 ? 10 : 5;
  const score = Math.round(clamp(marginScore + demoScore + competitionScore + shippingScore + problemScore));
  return { score, margin: Math.round(margin * 10) / 10 };
}

export function generateProduct(input: ProductInput): GeneratedProduct {
  const { score, margin } = scoreProduct(input);
  const title = input.name.trim() || "Clever Everyday Find";
  const handle = slugify(title);
  const featureList = input.features.split(/[,\n]/).map(v => v.trim()).filter(Boolean).slice(0, 6);
  const bullets = [
    `Makes ${input.problem || "everyday routines"} simpler`,
    ...featureList,
    `A smart pick for ${input.audience || "busy families"}`
  ].slice(0, 6);
  const verdict = score >= 80 ? "Strong test candidate" : score >= 65 ? "Worth a small test" : score >= 50 ? "Needs refinement" : "Skip for now";
  const tags = Array.from(new Set([input.category, "Fort Crazypants Find", "Problem Solver", input.audience].filter(Boolean)));
  const shopLink = input.mavelyLink.trim() || input.url.trim();
  const cta = shopLink ? `\n\nShop it here: ${shopLink}` : "";
  const descriptionHtml = `<h2>Why you'll love it</h2><p>${title} helps ${input.audience || "busy households"} solve ${input.problem || "an everyday frustration"} without adding more work to the day.</p><ul>${bullets.map(b => `<li>${b}</li>`).join("")}</ul><p><strong>Fort Crazypants verdict:</strong> practical, giftable, and easy to understand at a glance.</p>${shopLink ? `<p><a href="${shopLink}">Shop it here</a></p>` : ""}`;
  return {
    ...input,
    id: crypto.randomUUID(),
    createdAt: new Date().toISOString(),
    score,
    margin,
    verdict,
    title,
    handle,
    descriptionHtml,
    bullets,
    tags,
    seoTitle: `${title} | Fort Crazypants`,
    metaDescription: `Discover ${title}, a clever solution for ${input.problem || "everyday life"}. Shop practical, family-friendly finds from Fort Crazypants.`,
    altText: `${title} product image showing its key features and everyday use`,
    pinterestTitle: `${title}: A Clever Fix for ${input.problem || "Everyday Life"}`,
    pinterestDescription: `Meet ${title}—a practical, family-friendly find that helps with ${input.problem || "everyday routines"}. Save this idea and see why it earned a Fort Score of ${score}/100.`,
    instagramCaption: `This is the kind of find that makes you say, “Why didn’t I know about this sooner?” 🤯\n\n${title} helps with ${input.problem || "everyday chaos"} and earned a Fort Score of ${score}/100.\n\nWould this make life easier at your house?${cta}\n\n#FortCrazypants #FamilyFinds #ProblemSolver #SmartShopping`,
    facebookPost: `A clever little upgrade for real life: ${title}. It helps ${input.audience || "busy families"} with ${input.problem || "everyday routines"}, and our Fort Score came in at ${score}/100. Would you try it?${cta}`,
    reelScript: `HOOK: If ${input.problem || "this everyday annoyance"} drives you crazy, watch this.\nDEMO: Show the problem, then demonstrate ${title} in one clear motion.\nBENEFIT: Highlight ${bullets.slice(0, 2).join(" and ")}.\nPROOF: Fort Score ${score}/100 with an estimated ${margin}% gross margin.\nCTA: Tap to see the full find at Fort Crazypants.${shopLink ? ` Link: ${shopLink}` : ""}`,
    emailSubject: `A clever fix for ${input.problem || "everyday chaos"}`,
    emailBody: `Meet ${title}.\n\nWe picked this one because it makes ${input.problem || "daily routines"} easier without being complicated. It is practical, easy to demonstrate, and useful for ${input.audience || "busy families"}.\n\nFort Score: ${score}/100\n\nTake a closer look and decide whether it belongs in your home.${cta}`,
    blogTitle: `Is ${title} Worth It? Our Fort Crazypants Review`,
    blogBody: `${title} is designed to help with ${input.problem || "a common everyday frustration"}. In this review, we look at who it is for, what makes it useful, and whether it deserves a place in your routine.\n\nBest for: ${input.audience || "busy families"}.\n\nKey benefits: ${bullets.join("; ")}.\n\nOur Fort Score is ${score}/100. ${verdict}.${cta}`
  };
}
