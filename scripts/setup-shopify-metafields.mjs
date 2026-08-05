#!/usr/bin/env node
/**
 * One-time setup script: creates the 7 `custom.*` metafield definitions on the Product
 * resource that the Mavely Affiliate Product Importer relies on. Metafield *values* can
 * be set via metafieldsSet without a definition existing, but definitions give the
 * fields a nice UI in Shopify admin and basic validation, so it's worth running once.
 *
 * Idempotent: checks for each definition by namespace+key first and skips it if it
 * already exists, so it's safe to re-run.
 *
 * Usage:
 *   node --env-file=.env.local scripts/setup-shopify-metafields.mjs
 *
 * Requires SHOPIFY_STORE_DOMAIN and SHOPIFY_ADMIN_ACCESS_TOKEN (and optionally
 * SHOPIFY_API_VERSION) to be set in the environment.
 */

const domain = process.env.SHOPIFY_STORE_DOMAIN;
const token = process.env.SHOPIFY_ADMIN_ACCESS_TOKEN;
const version = process.env.SHOPIFY_API_VERSION || "2025-10";

if (!domain || !token) {
  console.error("Missing SHOPIFY_STORE_DOMAIN or SHOPIFY_ADMIN_ACCESS_TOKEN in the environment.");
  process.exit(1);
}

const DEFINITIONS = [
  { key: "mavely_link", name: "Mavely Link", type: "url", description: "Mavely affiliate link the storefront button sends customers to." },
  { key: "retailer_url", name: "Retailer URL", type: "url", description: "Original retailer product page this listing was imported from." },
  { key: "retailer_name", name: "Retailer Name", type: "single_line_text_field", description: "Name of the retailer selling this product (e.g. Target, Amazon)." },
  { key: "affiliate_product", name: "Affiliate Product", type: "boolean", description: "True if this product is an external Mavely affiliate listing." },
  { key: "external_button_label", name: "External Button Label", type: "single_line_text_field", description: "Label shown on the storefront affiliate button." },
  { key: "last_price_checked", name: "Last Price Checked", type: "date", description: "Date the price was last verified against the retailer." },
  { key: "original_price", name: "Original Price", type: "single_line_text_field", description: "Original/list price as text, for display alongside current price." }
];

async function shopifyGraphQL(query, variables) {
  const response = await fetch(`https://${domain}/admin/api/${version}/graphql.json`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "X-Shopify-Access-Token": token },
    body: JSON.stringify({ query, variables })
  });
  if (response.status === 401 || response.status === 403) {
    throw new Error(`Shopify rejected the credentials (status ${response.status}). Check the access token.`);
  }
  const data = await response.json();
  if (data.errors) {
    throw new Error(`Shopify GraphQL error: ${JSON.stringify(data.errors)}`);
  }
  return data.data;
}

const EXISTS_QUERY = `
  query CheckDefinition($namespace: String!, $key: String!, $ownerType: MetafieldOwnerType!) {
    metafieldDefinitions(namespace: $namespace, key: $key, ownerType: $ownerType, first: 1) {
      nodes { id }
    }
  }
`;

const CREATE_MUTATION = `
  mutation CreateDefinition($definition: MetafieldDefinitionInput!) {
    metafieldDefinitionCreate(definition: $definition) {
      createdDefinition { id name namespace key }
      userErrors { field message code }
    }
  }
`;

async function main() {
  console.log(`Setting up Mavely metafield definitions on ${domain} (API ${version})…`);
  for (const def of DEFINITIONS) {
    const existing = await shopifyGraphQL(EXISTS_QUERY, { namespace: "custom", key: def.key, ownerType: "PRODUCT" });
    if (existing.metafieldDefinitions.nodes.length) {
      console.log(`✓ custom.${def.key} already exists — skipping.`);
      continue;
    }

    const result = await shopifyGraphQL(CREATE_MUTATION, {
      definition: {
        name: def.name,
        namespace: "custom",
        key: def.key,
        description: def.description,
        type: def.type,
        ownerType: "PRODUCT"
      }
    });

    const errors = result.metafieldDefinitionCreate.userErrors;
    if (errors && errors.length) {
      // TAKEN means another process created it between our check and create — treat as success.
      if (errors.every(e => e.code === "TAKEN")) {
        console.log(`✓ custom.${def.key} already exists (race) — skipping.`);
        continue;
      }
      console.error(`✗ Failed to create custom.${def.key}:`, errors);
      continue;
    }

    console.log(`+ Created custom.${def.key}`);
  }
  console.log("Done.");
}

main().catch(err => {
  console.error(err.message || err);
  process.exit(1);
});
