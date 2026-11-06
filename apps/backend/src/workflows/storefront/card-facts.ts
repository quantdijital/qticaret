import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, getVariantAvailability } from "@medusajs/framework/utils"
import { storedAddonsOf } from "../../lib/catalog/addons"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { PRODUCT_ADDONS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { liveSettings } from "./layout-shared"

type Container = Pick<MedusaContainer, "resolve">

/** How much a product card says of its stock (adr/0046 Ek 2026-11-04): a bucket, never the number. */
export type StockBucket = "in_stock" | "low" | "out"

export interface CardFacts {
  stock: StockBucket
  /** Put straight in the cart from the card; null when the product needs its page first. */
  quick_add: { variant_id: string } | null
}

interface VariantRow {
  id: string
  manage_inventory?: boolean | null
  allow_backorder?: boolean | null
}

interface ProductRow {
  id: string
  status?: string | null
  variants?: (VariantRow | null)[] | null
  sales_channels?: ({ id: string } | null)[] | null
  product_extension?: { is_gift_card?: boolean | null; addons?: unknown } | null
}

/** A product's stock as the card says it: units summed over the variants that keep count. */
export function stockBucketOf(
  variants: readonly VariantRow[],
  available: (variantId: string) => number,
  lowAt: number
): StockBucket {
  // A variant that keeps no count, or sells past zero, is always to be had
  if (variants.some((variant) => !variant.manage_inventory || variant.allow_backorder)) {
    return "in_stock"
  }
  const units = variants.reduce((sum, variant) => sum + Math.max(0, available(variant.id)), 0)
  if (units <= 0) {
    return "out"
  }
  return lowAt > 0 && units <= lowAt ? "low" : "in_stock"
}

/**
 * Whether a card may put the product in the cart without its page: one
 * variant to be had, not a gift card (its recipient is asked), no add-on
 * the shopper must fill (asked on the page while the shop offers them).
 */
export function quickAddOf(
  product: ProductRow,
  stock: StockBucket,
  addonsOn: boolean
): CardFacts["quick_add"] {
  const variants = (product.variants ?? []).filter((variant): variant is VariantRow => !!variant)
  const [only] = variants
  if (variants.length !== 1 || !only || stock === "out") {
    return null
  }
  if (product.product_extension?.is_gift_card === true) {
    return null
  }
  if (
    addonsOn &&
    storedAddonsOf(product.product_extension?.addons).some((addon) => addon.required)
  ) {
    return null
  }
  return { variant_id: only.id }
}

/**
 * Card facts for a page of products (adr/0046 Ek 2026-11-04): the stock
 * bucket and the quick-add variant of each published product in one of
 * the shopper's sales channels; others are left out. One product read and
 * one stock read for the whole page. "Az kaldı" at the published design's
 * threshold (adr/0049 Ek 2026-11-06), else the old storefront field's.
 */
export async function cardFacts(
  container: Container,
  input: { product_ids: readonly string[]; sales_channel_ids: readonly string[] }
): Promise<Record<string, CardFacts>> {
  const ids = [...new Set(input.product_ids)]
  const channels = new Set(input.sales_channel_ids)
  const [channel] = input.sales_channel_ids
  if (ids.length === 0 || !channel) {
    return {}
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const settings = container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [{ data }, shared, addonsOn] = await Promise.all([
    query.graph({
      entity: "product",
      fields: [
        "id",
        "status",
        "variants.id",
        "variants.manage_inventory",
        "variants.allow_backorder",
        "sales_channels.id",
        "product_extension.is_gift_card",
        "product_extension.addons",
      ],
      filters: { id: ids },
    }),
    liveSettings(container),
    settings.isFeatureEnabled(PRODUCT_ADDONS),
  ])
  const shown = (data as ProductRow[]).filter(
    (product) =>
      product.status === "published" &&
      (product.sales_channels ?? []).some((each) => each && channels.has(each.id))
  )
  const variantsOf = (product: ProductRow) =>
    (product.variants ?? []).filter((variant): variant is VariantRow => !!variant)
  const counted = shown
    .flatMap(variantsOf)
    .filter((variant) => variant.manage_inventory && !variant.allow_backorder)
    .map((variant) => variant.id)
  const availability = counted.length
    ? await getVariantAvailability(query, { variant_ids: counted, sales_channel_id: channel })
    : {}
  const available = (variantId: string) => availability[variantId]?.availability ?? 0
  const lowAt = shared.low_stock_threshold
  return Object.fromEntries(
    shown.map((product) => {
      const stock = stockBucketOf(variantsOf(product), available, lowAt)
      return [product.id, { stock, quick_add: quickAddOf(product, stock, addonsOn) }]
    })
  )
}
