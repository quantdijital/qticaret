import type { ProductCatalog } from "@/features/products/api/product-edit"
import type { ProductDetail } from "@/features/products/api/products"

/** The variants card's specs: a product of three colours, its catalog, the server's answers. */

export const variant = (
  id: string,
  value: string,
  codes: Record<string, unknown> = {},
  amount: number | null = 3100
) => ({
  id,
  title: value,
  variant_rank: Number(id.slice(-1)),
  manage_inventory: false,
  allow_backorder: false,
  sku: null,
  ean: null,
  upc: null,
  barcode: null,
  options: [{ value, option_id: "opt_color" }],
  ...codes,
  prices: amount === null ? [] : [{ id: `price_${id}`, amount, currency_code: "try" }],
  inventory_items: [],
})

/** A counted variant with a stock level at the shop's location. */
export const stocked = (id: string, value: string, quantity: number) => ({
  ...variant(id, value),
  manage_inventory: true,
  inventory_items: [
    {
      inventory_item_id: `iitem_${id}`,
      inventory: {
        location_levels: [
          { location_id: "sloc_1", stocked_quantity: quantity, reserved_quantity: 0 },
        ],
      },
    },
  ],
})

export const COLOR = {
  id: "opt_color",
  title: "Renk",
  values: [
    { id: "optval_sari", value: "Sarı" },
    { id: "optval_pembe", value: "Pembe" },
    { id: "optval_mor", value: "Mor" },
  ],
}

export const PRODUCT = {
  id: "prod_1",
  title: "Yatağan Çakı",
  updated_at: "2026-11-05T09:00:00Z",
  options: [COLOR],
  images: [
    { id: "img_1", url: "https://cdn/1.jpg", rank: 0, variants: [] },
    { id: "img_2", url: "https://cdn/2.jpg", rank: 1, variants: [{ id: "variant_2" }] },
  ],
  media_assets: [
    { id: "media_2", url: "https://cdn/2.jpg", alt: "", file_id: "f2", derived_at: null },
  ],
  variants: [
    variant("variant_1", "Sarı", { sku: "MYL-1", ean: "8690000000005" }),
    variant("variant_2", "Pembe", { sku: "MYL-2", barcode: "RAF-25" }),
    variant("variant_3", "Mor", { sku: "MYL-3", ean: "8690000000005" }),
  ],
} as unknown as ProductDetail

export const CATALOG = {
  variants: [
    { id: "variant_1", title: "Sarı", sku: "MYL-1", mpn: null, cost: null, gtin: "8690000000005" },
    { id: "variant_2", title: "Pembe", sku: "MYL-2", mpn: null, cost: null, gtin: null },
    { id: "variant_3", title: "Mor", sku: "MYL-3", mpn: "M-3", cost: null, gtin: null },
  ],
} as unknown as ProductCatalog

export function answer(url: string): unknown {
  if (url === "/admin/features") {
    return { features: [] }
  }
  if (url.startsWith("/admin/platform-settings/")) {
    return { values: { weight_unit: "g", dimension_unit: "cm" } }
  }
  if (url.endsWith("/price-history")) {
    return { currency_code: "try", rule_version: "2025", window_days: 10, variants: [] }
  }
  return CATALOG
}
