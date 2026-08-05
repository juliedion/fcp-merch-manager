# Mavely affiliate theme snippets

These files are **not** pushed to Shopify automatically — this repo has no live theme
files, the storefront theme is managed separately in Shopify admin. Copy/paste these
manually via the Shopify theme editor's code editor (Online Store 2.0 themes).

## Files

- `snippets/affiliate-product-button.liquid` — the exact button markup from the spec.
  Renders only when `product.metafields.custom.mavely_link` is present.
- `snippets/affiliate-disclosure.liquid` — the affiliate disclosure paragraph, text
  pulled from a theme setting (`settings.affiliate_disclosure_text`) with a hardcoded
  fallback.
- `snippets/affiliate-price-disclaimer.liquid` — the "price shown was accurate…"
  disclaimer to show near the price.
- `snippets/affiliate-main-product-overrides.liquid` — wraps the three snippets above
  into one panel for the product page; include this instead of the normal buy box when
  the product is an affiliate product.
- `snippets/affiliate-product-card-overrides.liquid` — replacement for the Add to
  Cart / Quick Add control on collection, search, featured, and recommendation product
  cards. The card's image/title still link to the product's normal FCP page — this only
  swaps the bottom action control.
- `settings_schema-addition.json` — a settings group to merge into the theme's
  `config/settings_schema.json` so `affiliate_disclosure_text` is editable from
  Theme Settings.

## Where to splice these in

### 1. `config/settings_schema.json`

Open the theme's `config/settings_schema.json` in the Shopify theme code editor. Copy
the single object from `theme/settings_schema-addition.json` into the top-level array
(anywhere is fine — conventionally near the end, before `theme_info` if present isn't
required). Save. A new "Affiliate products" section will appear in **Online Store →
Themes → Customize → Theme settings**.

### 2. `sections/main-product.liquid`

Find the block that renders the buy box — usually a `product-form` include or an inline
block containing the quantity selector, Add to Cart button, Buy It Now / dynamic
checkout buttons, pickup availability, and shipping/inventory messaging. Wrap it:

```liquid
{% assign is_affiliate = product.metafields.custom.affiliate_product.value %}
{% if is_affiliate %}
  {% render 'affiliate-main-product-overrides', product: product %}
{% else %}
  {%- comment -%} ...existing quantity selector / add-to-cart / buy-it-now / pickup / shipping markup, unchanged... {%- endcomment -%}
{% endif %}
```

Exact tag names vary by theme (Dawn calls this `snippets/buy-buttons.liquid` included
from `main-product.liquid`; other themes inline it). Locate whichever block contains
`{% form 'product', product %}` and the add-to-cart `<button type="submit">` — that's
the block to gate.

### 3. Product card snippets (collection / search / featured / recommendations)

Most Online Store 2.0 themes use one shared snippet for product cards (Dawn:
`snippets/card-product.liquid`). Find where it renders the quick-add / add-to-cart
control and wrap it:

```liquid
{% assign is_affiliate = card_product.metafields.custom.affiliate_product.value %}
{% if is_affiliate %}
  {% render 'affiliate-product-card-overrides', product: card_product %}
{% else %}
  {%- comment -%} ...existing quick-add / add-to-cart control, unchanged... {%- endcomment -%}
{% endif %}
```

Leave the card's image and title links (`<a href="{{ card_product.url }}">`) exactly as
they are — they should still go to the FCP product page, not directly to Mavely.

### 4. CSS

`affiliate-product-button`, `affiliate-card-button`, `affiliate-disclosure`, and
`affiliate-price-disclaimer` are plain class names with no bundled CSS — they inherit
the theme's existing `.button` / `.button--primary` / `.button--secondary` styles where
used. Add a few lines to the theme's CSS file if you want custom spacing, e.g.:

```css
.affiliate-product-panel { display: grid; gap: 12px; margin: 16px 0; }
.affiliate-disclosure, .affiliate-price-disclaimer { font-size: 0.8em; color: #666; }
```

## Notes

- The button's `rel="sponsored nofollow noopener"` and `target="_blank"` are required —
  do not remove them (sponsored/nofollow signal this is a paid/affiliate link to search
  engines; noopener protects against tab-nabbing).
- `original_price` is stored both as a metafield (text, for display flexibility) and as
  the variant's native `compareAtPrice` (set by the Merch Manager when publishing) — a
  theme's default price snippet will typically already render the compare-at strike-
  through automatically without any snippet changes here, since it reads
  `product.compare_at_price` natively.
