import { z } from "zod";

const KNOWN_MAVELY_DOMAINS = ["mavely.app", "mvly.co", "getmavely.com", "share.mavely.app"];

export function looksLikeMavelyDomain(url: string): boolean {
  try {
    const host = new URL(url).hostname.toLowerCase();
    return KNOWN_MAVELY_DOMAINS.some(d => host === d || host.endsWith(`.${d}`));
  } catch {
    return false;
  }
}

export function validateAffiliateUrl(url: string): { valid: boolean; error?: string; warning?: string } {
  const trimmed = url.trim();
  if (!trimmed) return { valid: false, error: "Mavely affiliate link is required." };
  if (/\s/.test(trimmed)) return { valid: false, error: "Affiliate link cannot contain spaces." };
  if (!/^https:\/\//i.test(trimmed)) return { valid: false, error: "Affiliate link must start with https://." };
  try {
    // eslint-disable-next-line no-new
    new URL(trimmed);
  } catch {
    return { valid: false, error: "That is not a valid URL." };
  }
  if (!looksLikeMavelyDomain(trimmed)) {
    return { valid: true, warning: "This link doesn't look like a typical Mavely domain. Double-check it before publishing." };
  }
  return { valid: true };
}

export const slugify = (value: string) =>
  value
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

export const mavelyProductInputSchema = z.object({
  retailerUrl: z.string().default(""),
  mavelyLink: z.string().min(1, "Mavely affiliate link is required."),
  title: z.string().min(2, "Title is required."),
  descriptionHtml: z.string().default(""),
  shortSummary: z.string().default(""),
  retailerName: z.string().default(""),
  currentPrice: z.coerce.number().min(0, "Current price must be zero or greater."),
  originalPrice: z.coerce.number().min(0).nullable().optional(),
  images: z.array(z.string()).default([]),
  category: z.string().default(""),
  collection: z.string().default(""),
  tags: z.array(z.string()).default([]),
  vendor: z.string().default(""),
  sku: z.string().default(""),
  buttonLabel: z.string().default("Shop Now"),
  seoTitle: z.string().default(""),
  seoDescription: z.string().default(""),
  status: z.enum(["DRAFT", "ACTIVE", "ARCHIVED"]).default("DRAFT")
});

export type ValidatedMavelyProductInput = z.infer<typeof mavelyProductInputSchema>;
