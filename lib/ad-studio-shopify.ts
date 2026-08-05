import { shopifyGraphQL } from "./mavely-shopify";
import { AdProductSnapshot } from "./ad-studio-types";

// Admin GraphQL product-listing/search query. Nothing in lib/mavely-shopify.ts fetches
// products today (only productSet/productDelete mutations for publishing) — this is a
// new read-only query added specifically for the Ad Studio product picker (step 1).
const PRODUCTS_SEARCH_QUERY = `
  query AdStudioProductsSearch($first: Int!, $query: String) {
    products(first: $first, query: $query) {
      nodes {
        id
        title
        handle
        descriptionHtml
        vendor
        productType
        tags
        onlineStoreUrl
        collections(first: 10) { nodes { title } }
        media(first: 10) {
          nodes {
            ... on MediaImage {
              image { url altText }
            }
          }
        }
        variants(first: 1) {
          nodes { price compareAtPrice }
        }
      }
    }
  }
`;

type ShopifyProductNode = {
  id: string;
  title: string;
  handle: string;
  descriptionHtml: string;
  vendor: string;
  productType: string;
  tags: string[];
  onlineStoreUrl: string | null;
  collections: { nodes: { title: string }[] };
  media: { nodes: { image?: { url: string; altText: string | null } }[] };
  variants: { nodes: { price: string; compareAtPrice: string | null }[] };
};

function stripHtml(html: string): string {
  return html.replace(/<[^>]+>/g, " ").replace(/\s+/g, " ").trim();
}

function nodeToSnapshot(node: ShopifyProductNode): AdProductSnapshot {
  const variant = node.variants.nodes[0];
  const price = variant ? Number(variant.price) : 0;
  const compareAtPrice = variant?.compareAtPrice ? Number(variant.compareAtPrice) : null;
  const images = node.media.nodes.map(m => m.image?.url).filter((v): v is string => Boolean(v));
  const description = stripHtml(node.descriptionHtml || "");
  return {
    source: "shopify",
    sourceId: node.id,
    title: node.title,
    description,
    images,
    price,
    compareAtPrice,
    vendor: node.vendor || "",
    productType: node.productType || "",
    tags: node.tags || [],
    collections: node.collections.nodes.map(c => c.title),
    handle: node.handle,
    productUrl: node.onlineStoreUrl || "",
    isAffiliate: false,
    affiliateUrl: null,
    retailerName: null,
    benefits: parseBenefitsFromDescriptionAndTags(description, node.tags || []),
    seoDescription: description.slice(0, 320)
  };
}

/** Very simple heuristic: pulls short, feature-like sentences/clauses out of the
 * description plus any tags, capped to a handful of items — used to pre-fill
 * "existing benefits/features" in the product-select step. */
export function parseBenefitsFromDescriptionAndTags(description: string, tags: string[]): string[] {
  const fromDescription = description
    .split(/[.\n•\-]/)
    .map(s => s.trim())
    .filter(s => s.length > 6 && s.length < 90)
    .slice(0, 4);
  const fromTags = tags.filter(t => t.length > 2 && t.length < 40).slice(0, 3);
  return Array.from(new Set([...fromDescription, ...fromTags])).slice(0, 6);
}

/** Search live Shopify products by title for the Ad Studio product picker (step 1). */
export async function searchShopifyProducts(search: string, first = 20): Promise<AdProductSnapshot[]> {
  const query = search.trim() ? `title:*${search.trim().replace(/[":]/g, "")}*` : undefined;
  const data = await shopifyGraphQL<{ products: { nodes: ShopifyProductNode[] } }>(PRODUCTS_SEARCH_QUERY, {
    first,
    query
  });
  return data.products.nodes.map(nodeToSnapshot);
}
