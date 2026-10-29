import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { chunksOf } from "../../../lib/catalog"
import { PRICE_FIELDS } from "../prices"
import type { PriceRow } from "../prices"
import type { BulkAction } from "./change"

/** A product as bulk edit reads it; each change reads only its own part (F3.10). */
export interface BulkProduct {
  id: string
  handle: string
  title: string
  status: string
  categories?: ({ id: string; mpath?: string | null } | null)[] | null
  product_extension?: { primary_category_id?: string | null } | null
  seo_meta?: { seo_title?: string | null; seo_description?: string | null } | null
  options?: { id: string; title: string }[] | null
  variants?: BulkVariant[] | null
  images?: { id: string; url: string; rank?: number | null; variants?: { id: string }[] | null }[]
  media_assets?: ({ id: string; url: string; alt?: string | null } | null)[] | null
}

export interface BulkVariant {
  id: string
  manage_inventory?: boolean | null
  options?: { value: string; option_id: string }[] | null
  prices?: PriceRow[] | null
  /** The unit cost in kuruş (F11.4). */
  variant_extension?: { cost?: number | null } | null
  inventory_items?:
    | {
        inventory_item_id: string
        required_quantity?: number | null
        inventory?: {
          location_levels?: { location_id: string; stocked_quantity: number | string }[] | null
        } | null
      }[]
    | null
}

const BASE = ["id", "handle", "title", "status"]

const FIELDS: Readonly<Record<BulkAction, readonly string[]>> = {
  price: [...BASE, "variants.id", ...PRICE_FIELDS],
  stock: [
    ...BASE,
    "variants.id",
    "variants.manage_inventory",
    "variants.inventory_items.inventory_item_id",
    "variants.inventory_items.required_quantity",
    "variants.inventory_items.inventory.location_levels.location_id",
    "variants.inventory_items.inventory.location_levels.stocked_quantity",
  ],
  status: BASE,
  cost: [...BASE, "variants.id", "variants.variant_extension.cost"],
  category: [...BASE, "categories.id", "categories.mpath", "product_extension.primary_category_id"],
  seo_template: [...BASE, "seo_meta.seo_title", "seo_meta.seo_description"],
  alt_text: [
    ...BASE,
    "options.id",
    "options.title",
    "variants.id",
    "variants.options.value",
    "variants.options.option_id",
    "images.id",
    "images.url",
    "images.rank",
    "images.variants.id",
    "media_assets.id",
    "media_assets.url",
    "media_assets.alt",
  ],
}

// Products read with their variants per query
const PRODUCT_CHUNK = 100

/** The products a run names, in the order named; ones that are gone are left out. */
export async function bulkProducts(
  container: MedusaContainer,
  ids: readonly string[],
  action: BulkAction
): Promise<BulkProduct[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const found = new Map<string, BulkProduct>()
  for (const chunk of chunksOf(ids, PRODUCT_CHUNK)) {
    const { data } = await query.graph({
      entity: "product",
      fields: [...FIELDS[action]],
      filters: { id: chunk },
    })
    for (const row of data as unknown as BulkProduct[]) {
      found.set(row.id, row)
    }
  }
  return ids.flatMap((id) => {
    const product = found.get(id)
    return product ? [product] : []
  })
}
