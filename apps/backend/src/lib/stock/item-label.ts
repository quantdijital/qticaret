/** What an inventory item is called where the shop sees it; never its id. */
export interface StockItemNames {
  product?: string | null | undefined
  variant?: string | null | undefined
  /** The inventory item's own title and SKU: an item that sells as no product. */
  item?: string | null | undefined
  sku?: string | null | undefined
}

// Medusa's name for a product's only variant when none is given
const PLACEHOLDER_VARIANTS = new Set(["default variant", "default", "varsayılan"])

const clean = (value: string | null | undefined) => (value ?? "").trim()

/**
 * "Sürmene Şef Bıçağı — Kahve": the product, then its variant when that
 * says more (not empty, not the product's own title, not Medusa's
 * placeholder). An item with no product is its own title, else its SKU;
 * with none of them, "" (the reader words it as "a product").
 */
export function stockItemLabel(names: StockItemNames): string {
  const product = clean(names.product)
  const variant = clean(names.variant)
  if (product) {
    const same = variant.toLocaleLowerCase("tr") === product.toLocaleLowerCase("tr")
    const placeholder = PLACEHOLDER_VARIANTS.has(variant.toLocaleLowerCase("tr"))
    return variant && !same && !placeholder ? `${product} — ${variant}` : product
  }
  return clean(names.item) || clean(names.sku)
}
