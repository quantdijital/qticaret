import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"

// A deleted row too: its price set still says whose price it was
const READ = { withDeleted: true, take: null } as const

const setsOf = (prices: { price_set_id?: string | null }[]): string[] =>
  prices.flatMap((price) => (price.price_set_id ? [price.price_set_id] : []))

/** The price sets these prices belong to. */
export async function priceSetsOfPrices(container: MedusaContainer, ids: string[]) {
  const prices = await container
    .resolve(Modules.PRICING)
    .listPrices({ id: ids }, { select: ["price_set_id"], ...READ })
  return setsOf(prices)
}

/** The price sets a price list prices: every one of its rows, not a page of them. */
export async function priceSetsOfLists(container: MedusaContainer, listIds: string[]) {
  if (listIds.length === 0) {
    return []
  }
  const prices = await container
    .resolve(Modules.PRICING)
    .listPrices({ price_list_id: listIds }, { select: ["price_set_id"], ...READ })
  return setsOf(prices)
}

/** The variants whose prices these price sets hold. */
export async function variantsOfPriceSets(
  container: MedusaContainer,
  priceSetIds: string[]
): Promise<string[]> {
  if (priceSetIds.length === 0) {
    return []
  }
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product_variant_price_set",
    fields: ["variant_id"],
    filters: { price_set_id: [...new Set(priceSetIds)] },
  })
  return (data as { variant_id: string }[]).map((link) => link.variant_id)
}
