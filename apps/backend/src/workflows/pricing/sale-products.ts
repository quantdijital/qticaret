import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { chunksOf } from "../../lib/catalog"
import { isMarkedDown, saleProducts } from "../../lib/pricing"
import { CURRENCY } from "../catalog/prices"
import { priceDisplays } from "./price-display"
import { variantsOfPriceSets } from "./priced-variants"
import { sellingPrices } from "./selling-prices"

/** The sale listing's type and id (`/kampanyalar`; `GET /store/listings/products?type=sale&id=sale`). */
export const SALE_LISTING = "sale"

interface VariantRow {
  id: string
  product_id: string
  product?: { status?: string | null } | null
}

/**
 * The published products on sale now (adr/0019 ek 2026-11-03): a variant
 * of theirs sells below its original price for a shopper with no customer
 * group, in the shop's currency, and the 30-day rule shows it as a
 * discount (ADR-0023), as the storefront's price does. Only variants an
 * active price list prices can be marked down, so the catalogue is not
 * scanned. The callers keep the answer (the listing's rows, resolve's
 * answers) for their own 30 seconds.
 */
export async function saleProductIds(container: MedusaContainer): Promise<string[]> {
  const pricing = container.resolve(Modules.PRICING)
  const lists = await pricing.listPriceLists({ status: ["active"] }, { select: ["id"], take: null })
  if (lists.length === 0) {
    return []
  }
  const prices = await pricing.listPrices(
    { price_list_id: lists.map((list) => list.id) },
    { select: ["price_set_id"], take: null }
  )
  const listed = await variantsOfPriceSets(
    container,
    prices.flatMap((price) => (price.price_set_id ? [price.price_set_id] : []))
  )
  const markedDown: string[] = []
  for (const chunk of chunksOf([...new Set(listed)])) {
    for (const variant of await sellingPrices(container, chunk, CURRENCY)) {
      if (isMarkedDown(variant.calculated_price)) {
        markedDown.push(variant.id)
      }
    }
  }
  if (markedDown.length === 0) {
    return []
  }
  const displays = await priceDisplays(container, markedDown, CURRENCY)
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const variants: VariantRow[] = []
  for (const chunk of chunksOf(markedDown)) {
    const { data } = await query.graph({
      entity: "product_variant",
      fields: ["id", "product_id", "product.status"],
      filters: { id: chunk },
    })
    variants.push(...(data as VariantRow[]))
  }
  return saleProducts(
    variants.filter((variant) => variant.product?.status === "published"),
    displays
  )
}
