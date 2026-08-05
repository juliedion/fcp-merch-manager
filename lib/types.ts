export type ProductInput = {
  url: string;
  mavelyLink: string;
  name: string;
  cost: number;
  price: number;
  category: string;
  audience: string;
  problem: string;
  features: string;
  shippingDays: number;
  competition: "low" | "medium" | "high";
  demoFactor: number;
};

export type GeneratedProduct = ProductInput & {
  id: string;
  createdAt: string;
  score: number;
  margin: number;
  verdict: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  bullets: string[];
  tags: string[];
  seoTitle: string;
  metaDescription: string;
  altText: string;
  pinterestTitle: string;
  pinterestDescription: string;
  instagramCaption: string;
  facebookPost: string;
  reelScript: string;
  emailSubject: string;
  emailBody: string;
  blogTitle: string;
  blogBody: string;
};
