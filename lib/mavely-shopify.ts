import { MavelyProductInput } from "./mavely-types";

export class ShopifyAuthError extends Error {
  constructor(message = "Shopify rejected the request credentials (401/403). Check SHOPIFY_ADMIN_ACCESS_TOKEN.") {
    super(message);
    this.name = "ShopifyAuthError";
  }
}

export class ShopifyRateLimitError extends Error {
  constructor(message = "Shopify is rate limiting this store (429/THROTTLED). Wait a moment and try again.") {
    super(message);
    this.name = "ShopifyRateLimitError";
  }
}

export class ShopifyUserError extends Error {
  errors: Array<{ field?: string[]; message: string }>;
  constructor(errors: Array<{ field?: string[]; message: string }>) {
    super(errors.map(e => e.message).join("; ") || "Shopify rejected the request.");
    this.name = "ShopifyUserError";
    this.errors = errors;
  }
}

function getConfig() {
  const domain = process.env.SHOPIFY_STORE_DOMAIN;
  const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
  const version = process.env.SHOPIFY_API_VERSION || "2025-10";
  if (!domain || !token) {
    throw new Error("Shopify credentials are not configured (SHOPIFY_STORE_DOMAIN / SHOPIFY_ADMIN_ACCESS_TOKEN).");
  }
  return { domain, token, version };
}

/**
 * Low-level Admin GraphQL request. Never logs the raw access token. Throws typed
 * errors for auth failures and rate limiting so API routes can surface clear messages.
 */
export async function shopifyGraphQL<T = any>(query: string, variables?: Record<string, unknown>): Promise<T> {
  const { domain, token, version } = getConfig();
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables })
  });

  if (response.status === 401 || response.status === 403) {
    throw new ShopifyAuthError();
  }
  if (response.status === 429) {
    throw new ShopifyRateLimitError();
  }

  const data = await response.json();

  if (data?.errors) {
    const messages: string[] = Array.isArray(data.errors) ? data.errors.map((e: any) => e?.message || String(e)) : [String(data.errors)];
    if (messages.some(m => /throttled/i.test(m))) throw new ShopifyRateLimitError();
    console.error("Shopify GraphQL top-level errors (status", response.status, "):", messages);
    throw new Error(`Shopify GraphQL error: ${messages.join("; ")}`);
  }

  if (!response.ok) {
    console.error("Shopify GraphQL request failed with status", response.status);
    throw new Error(`Shopify API returned status ${response.status}.`);
  }

  return data.data as T;
}

function assertNoUserErrors(userErrors: Array<{ field?: string[]; message: string }> | undefined) {
  if (userErrors && userErrors.length) throw new ShopifyUserError(userErrors);
}

export function storeDomain(): string {
  return process.env.SHOPIFY_STORE_DOMAIN || "";
}

export function adminProductUrl(numericId: string): string {
  return `https://${storeDomain()}/admin/products/${numericId}`;
}

export function storefrontProductUrl(handle: string): string {
  return `https://${storeDomain()}/products/${handle}`;
}

export function numericIdFromGid(gid: string): string {
  const match = gid.match(/(\d+)$/);
  return match ? match[1] : gid;
}

type ProductResult = { id: string; title: string; handle: string; status: string };

const PRODUCT_SET_MUTATION = `
  mutation MavelyProductSet($input: ProductSetInput!) {
    productSet(input: $input, synchronous: true) {
      product { id title handle status variants(first: 1) { nodes { id } } }
      userErrors { field message }
    }
  }
`;

/**
 * Creates or updates a Shopify product using productSet (2025-10), which supports
 * upserting title/description/status/vendor/productType/tags, a single default
 * variant with price + compareAtPrice, and images by URL in one call. This is the
 * simplest correct mutation for affiliate listings sourced from remote image URLs.
 */
export async function upsertShopifyProduct(input: MavelyProductInput, existingProductGid?: string | null): Promise<ProductResult> {
  const productSetInput: Record<string, unknown> = {
    title: input.title,
    descriptionHtml: input.descriptionHtml,
    vendor: input.vendor || undefined,
    productType: input.category || undefined,
    tags: input.tags,
    status: input.status === "ARCHIVED" ? "ARCHIVED" : input.status === "ACTIVE" ? "ACTIVE" : "DRAFT",
    variants: [
      {
        price: input.currentPrice.toFixed(2),
        compareAtPrice: input.originalPrice && input.originalPrice > input.currentPrice ? input.originalPrice.toFixed(2) : null,
        inventoryPolicy: "CONTINUE",
        inventoryItem: { tracked: false },
        optionValues: [{ optionName: "Title", name: "Default Title" }]
      }
    ],
    productOptions: [{ name: "Title", values: [{ name: "Default Title" }] }]
  };

  if (existingProductGid) productSetInput.id = existingProductGid;
  if (input.images.length) {
    productSetInput.files = input.images.map(src => ({ originalSource: src, contentType: "IMAGE" }));
  }
  if (input.seoTitle || input.seoDescription) {
    productSetInput.seo = { title: input.seoTitle || undefined, description: input.seoDescription || undefined };
  }

  const data = await shopifyGraphQL<{ productSet: { product: ProductResult; userErrors: any[] } }>(PRODUCT_SET_MUTATION, {
    input: productSetInput
  });
  assertNoUserErrors(data.productSet.userErrors);
  if (!data.productSet.product) throw new Error("Shopify did not return a product from productSet.");
  return data.productSet.product;
}

const METAFIELDS_SET_MUTATION = `
  mutation MavelyMetafieldsSet($metafields: [MetafieldsSetInput!]!) {
    metafieldsSet(metafields: $metafields) {
      metafields { id key namespace }
      userErrors { field message }
    }
  }
`;

export async function setAffiliateMetafields(productGid: string, input: MavelyProductInput): Promise<void> {
  const metafields = [
    { ownerId: productGid, namespace: "custom", key: "mavely_link", type: "url", value: input.mavelyLink },
    { ownerId: productGid, namespace: "custom", key: "retailer_url", type: "url", value: input.retailerUrl || input.mavelyLink },
    { ownerId: productGid, namespace: "custom", key: "retailer_name", type: "single_line_text_field", value: input.retailerName || "" },
    { ownerId: productGid, namespace: "custom", key: "affiliate_product", type: "boolean", value: "true" },
    { ownerId: productGid, namespace: "custom", key: "external_button_label", type: "single_line_text_field", value: input.buttonLabel || "Shop Now" },
    { ownerId: productGid, namespace: "custom", key: "last_price_checked", type: "date", value: new Date().toISOString().slice(0, 10) },
    {
      ownerId: productGid,
      namespace: "custom",
      key: "original_price",
      type: "single_line_text_field",
      value: input.originalPrice ? input.originalPrice.toFixed(2) : ""
    }
  ].filter(m => m.value !== "" || m.key === "affiliate_product");

  const data = await shopifyGraphQL<{ metafieldsSet: { userErrors: any[] } }>(METAFIELDS_SET_MUTATION, { metafields });
  assertNoUserErrors(data.metafieldsSet.userErrors);
}

const COLLECTION_BY_TITLE_QUERY = `
  query MavelyFindCollection($query: String!) {
    collections(first: 1, query: $query) { nodes { id title } }
  }
`;

const COLLECTION_ADD_PRODUCTS_MUTATION = `
  mutation MavelyAddToCollection($id: ID!, $productIds: [ID!]!) {
    collectionAddProducts(id: $id, productIds: $productIds) {
      collection { id }
      userErrors { field message }
    }
  }
`;

/** Adds the product to a collection by title, if a collection with that title exists. */
export async function addProductToCollectionByTitle(productGid: string, collectionTitle: string): Promise<{ found: boolean }> {
  if (!collectionTitle.trim()) return { found: false };
  const data = await shopifyGraphQL<{ collections: { nodes: Array<{ id: string; title: string }> } }>(COLLECTION_BY_TITLE_QUERY, {
    query: `title:'${collectionTitle.replace(/'/g, "")}'`
  });
  const collection = data.collections.nodes[0];
  if (!collection) return { found: false };
  const result = await shopifyGraphQL<{ collectionAddProducts: { userErrors: any[] } }>(COLLECTION_ADD_PRODUCTS_MUTATION, {
    id: collection.id,
    productIds: [productGid]
  });
  assertNoUserErrors(result.collectionAddProducts.userErrors);
  return { found: true };
}

/**
 * Full publish/update flow: upsert the product, set images via productSet's files
 * input, add to collection, and write affiliate metafields. Returns everything the
 * UI needs to show links back to Shopify and the storefront.
 */
export async function publishMavelyProductToShopify(input: MavelyProductInput, existingProductGid?: string | null) {
  const product = await upsertShopifyProduct(input, existingProductGid);
  await setAffiliateMetafields(product.id, input);
  let collectionWarning: string | undefined;
  if (input.collection.trim()) {
    const { found } = await addProductToCollectionByTitle(product.id, input.collection);
    if (!found) collectionWarning = `Collection "${input.collection}" was not found in Shopify — the product was created without it. Add it manually in Shopify admin.`;
  }
  const numericId = numericIdFromGid(product.id);
  return {
    productGid: product.id,
    numericId,
    handle: product.handle,
    status: product.status,
    adminUrl: adminProductUrl(numericId),
    storefrontUrl: storefrontProductUrl(product.handle),
    collectionWarning
  };
}

const PRODUCT_DELETE_MUTATION = `
  mutation MavelyProductDelete($input: ProductDeleteInput!) {
    productDelete(input: $input) { deletedProductId userErrors { field message } }
  }
`;

export async function deleteShopifyProduct(productGid: string): Promise<void> {
  const data = await shopifyGraphQL<{ productDelete: { userErrors: any[] } }>(PRODUCT_DELETE_MUTATION, {
    input: { id: productGid }
  });
  assertNoUserErrors(data.productDelete.userErrors);
}
