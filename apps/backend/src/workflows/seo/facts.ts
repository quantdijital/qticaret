import { ADULT_CONSIDERATIONS, restrictionOf, variantGtin } from "../../lib/catalog"
import type { Restriction } from "../../lib/catalog"
import { toMedusaAmount } from "../../lib/money"
import type { Kurus } from "../../lib/money"
import { productMarkOf } from "../../lib/orders/withdrawal-rules"
import type { PriceDisplay } from "../../lib/pricing"
import { VARIES_BY_PROPERTIES } from "../../lib/seo/jsonld"
import type { Availability, Condition, ProductFacts, VariesBy } from "../../lib/seo/jsonld"
import type { ReturnsSettings } from "../../modules/platform-settings/sections"
import { shippingRateOf, unitParcelOf } from "./shipping-facts"
import type { ShippingFacts } from "./shipping-facts"

export type { ShippingFacts } from "./shipping-facts"

/**
 * The facts a product's structured data is built from (F3.12): its
 * variants with their codes, prices and stock, the same sources the page
 * and the feeds use (docs/13 §5). Pure, so tested on its own.
 */

/** Fields a product's facts need, beside the payload's own. */
export const PRODUCT_FACT_FIELDS = [
  "handle",
  "images.url",
  "images.rank",
  "product_extension.condition",
  "product_extension.kind",
  "product_extension.withdrawal_excluded",
  "product_extension.restriction",
  "categories.id",
  "categories.mpath",
  "attribute_template.definitions.scope",
  "attribute_template.definitions.option_title",
  "attribute_template.definitions.varies_by",
  "variants.id",
  "variants.title",
  "variants.variant_rank",
  "variants.created_at",
  "variants.sku",
  "variants.ean",
  "variants.upc",
  "variants.barcode",
  "variants.manage_inventory",
  "variants.weight",
  "variants.length",
  "variants.width",
  "variants.height",
  "variants.allow_backorder",
  "variants.variant_extension.mpn",
  "variants.options.value",
  "variants.options.option.title",
  "variants.inventory_items.inventory.location_levels.available_quantity",
]

interface PriceRow {
  amount?: unknown
  currency_code?: string | null
  price_list_id?: string | null
}

export interface FactRow {
  title: string
  handle: string
  thumbnail?: string | null
  images?: ({ url: string; rank?: number | null } | null)[] | null
  product_extension?: {
    condition?: Condition | null
    /** F3.2: only a physical product ships; none read as physical. */
    kind?: string | null
    withdrawal_excluded?: boolean | null
    restriction?: string | null
  } | null
  categories?: ({ id: string; mpath?: string | null } | null)[] | null
  attribute_template?: {
    definitions?:
      | ({
          scope?: string | null
          option_title?: string | null
          varies_by?: string | null
        } | null)[]
      | null
  } | null
  variants?:
    | ({
        id: string
        title?: string | null
        variant_rank?: number | null
        created_at?: string | Date | null
        sku?: string | null
        ean?: string | null
        upc?: string | null
        barcode?: string | null
        manage_inventory?: boolean | null
        allow_backorder?: boolean | null
        weight?: number | null
        length?: number | null
        width?: number | null
        height?: number | null
        variant_extension?: { mpn?: string | null } | null
        options?:
          ({ value?: string | null; option?: { title?: string | null } | null } | null)[] | null
        prices?: PriceRow[] | null
        inventory_items?:
          | ({
              inventory?: {
                location_levels?: ({ available_quantity?: unknown } | null)[] | null
              } | null
            } | null)[]
          | null
      } | null)[]
    | null
}

type Variant = NonNullable<NonNullable<FactRow["variants"]>[number]>

const timeOf = (value: string | Date | null | undefined): number =>
  value ? new Date(value).getTime() : 0

const isVariesBy = (value: unknown): value is VariesBy =>
  (VARIES_BY_PROPERTIES as readonly unknown[]).includes(value)

/** Gross TRY price of the variant (no price list), or null. */
export function liraOf(variant: Variant): number | null {
  const price = (variant.prices ?? []).find(
    (row) => row.currency_code?.toLowerCase() === "try" && !row.price_list_id
  )
  const amount = Number(price?.amount)
  return Number.isFinite(amount) && amount > 0 ? amount : null
}

// Without displays the variant's own price; with them, a variant missing from them
// has no price a shopper can pay, so no offer
function priceOf(variant: Variant, displays: ReadonlyMap<string, PriceDisplay> | undefined) {
  if (!displays) {
    return { price: liraOf(variant), strikethrough: null }
  }
  const display = displays.get(variant.id)
  return {
    price: display ? lira(display.current) : null,
    strikethrough: display?.before ? lira(display.before) : null,
  }
}

/** Units available at every location; null when the variant keeps no stock count. */
function stockOf(variant: Variant): number | null {
  if (variant.manage_inventory === false) {
    return null
  }
  return (variant.inventory_items ?? []).reduce(
    (total, item) =>
      total +
      (item?.inventory?.location_levels ?? []).reduce(
        (sum, level) => sum + Math.max(0, Number(level?.available_quantity) || 0),
        0
      ),
    0
  )
}

function availabilityOf(variant: Variant): Availability {
  const available = stockOf(variant)
  if (available === null) {
    return "InStock"
  }
  return available > 0 ? "InStock" : variant.allow_backorder ? "BackOrder" : "OutOfStock"
}

/** What each option means to search engines: the template's `varies_by` per option title. */
function propertiesByOption(row: FactRow): Map<string, VariesBy> {
  const map = new Map<string, VariesBy>()
  for (const definition of row.attribute_template?.definitions ?? []) {
    if (
      definition?.scope === "variant" &&
      definition.option_title &&
      isVariesBy(definition.varies_by)
    ) {
      map.set(definition.option_title, definition.varies_by)
    }
  }
  return map
}

const lira = (amount: Kurus): number => Number(toMedusaAmount(amount))

/**
 * A product's facts for its structured data. With `displays` (F4.3) an
 * offer carries the price the shopper pays now and, where the 30-day rule
 * allows, the price struck through; without, the variant's own price.
 * With `shipping` (F7.8) an offer whose variant the shop's table prices
 * carries its shipping details.
 */
export function productFacts(
  row: FactRow,
  brand: string | null,
  description: string,
  displays?: ReadonlyMap<string, PriceDisplay>,
  shipping?: ShippingFacts,
  returns?: ReturnsSettings,
  /** The categories marked adults only; null while the shop has the flag off (F13.4). */
  restricted?: ReadonlyMap<string, Restriction> | null
): ProductFacts {
  const byOption = propertiesByOption(row)
  const physical = (row.product_extension?.kind ?? "physical") === "physical"
  const images = [...(row.images ?? [])]
    .filter((image): image is { url: string; rank?: number | null } => image !== null)
    .sort((a, b) => (a.rank ?? 0) - (b.rank ?? 0))
    .map((image) => image.url)
  // In the order the shop shows them (Medusa's variant rank)
  const variants = (row.variants ?? [])
    .filter((variant): variant is Variant => variant !== null)
    .sort(
      (a, b) =>
        (a.variant_rank ?? 0) - (b.variant_rank ?? 0) ||
        timeOf(a.created_at) - timeOf(b.created_at) ||
        a.id.localeCompare(b.id)
    )
    .map((variant) => {
      const properties: Partial<Record<VariesBy, string>> = {}
      for (const option of variant.options ?? []) {
        const property = byOption.get(option?.option?.title ?? "")
        if (property && option?.value) {
          properties[property] = option.value
        }
      }
      // F3.2: a digital or service product has no parcel, measured or not
      const parcel = shipping && physical ? unitParcelOf(variant, shipping) : null
      return {
        id: variant.id,
        name: variant.title ? `${row.title} – ${variant.title}` : row.title,
        sku: variant.sku?.trim() ? variant.sku.trim() : null,
        gtin: variantGtin(variant),
        mpn: variant.variant_extension?.mpn ?? null,
        image: null,
        ...priceOf(variant, displays),
        availability: availabilityOf(variant),
        properties,
        shippingRate: shipping ? shippingRateOf(parcel, shipping) : null,
        stock: stockOf(variant),
        // A feed's volume is the product's own: not one the default parcel made up
        desi: parcel?.measured ? parcel.desi : null,
      }
    })
  const used = new Set(variants.flatMap((variant) => Object.keys(variant.properties)))
  return {
    name: row.title,
    description,
    images: images.length > 0 ? images : row.thumbnail ? [row.thumbnail] : [],
    brand,
    condition: row.product_extension?.condition ?? "new",
    groupId: row.handle,
    variesBy: [...byOption.values()].filter(
      (property, index, all) => used.has(property) && all.indexOf(property) === index
    ),
    variants,
    delivery: shipping
      ? {
          handling: [shipping.settings.handling_days_min, shipping.settings.handling_days_max],
          transit: [shipping.settings.transit_days_min, shipping.settings.transit_days_max],
        }
      : null,
    // F13.6: the shop's return policy, this product's exclusion. A physical
    // product's mark is a sealed good, returnable unopened (adr/0052 Ek
    // 2026-11-03); a withdrawal's return costs the shopper nothing (MSY md. 12/5)
    returnPolicy: returns
      ? {
          days: returns.withdrawal_days,
          freeReturn: true,
          excluded: productMarkOf(
            row.product_extension?.withdrawal_excluded,
            row.product_extension?.kind
          ).excluded,
        }
      : null,
    adultConsideration: adultConsiderationOf(row, restricted),
  }
}

/** schema.org's adult consideration for a product sold to adults only (F13.4), or null. */
function adultConsiderationOf(
  row: FactRow,
  restricted: ReadonlyMap<string, Restriction> | null | undefined
): string | null {
  if (!restricted) {
    return null
  }
  const restriction = restrictionOf(row.product_extension?.restriction, row.categories, restricted)
  return restriction ? ADULT_CONSIDERATIONS[restriction] : null
}
