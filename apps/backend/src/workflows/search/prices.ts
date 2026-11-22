import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, QueryContext } from "@medusajs/framework/utils"
import { toMedusaAmount } from "../../lib/money"
import type { ProductShown } from "../../lib/pricing"
import { CURRENCY } from "../catalog/prices"
import { productsShown } from "../pricing/sale-products"

/**
 * A product's prices as the search index keeps them (adr/0056): its lowest
 * selling price per region for a shopper with no customer group; in the
 * shop's currency the lowest price the storefront shows instead (an
 * automatic promotion every shopper gets included, adr/0023 Ek
 * 2026-11-05), so a listing filters and sorts by what its cards say; and
 * whether it is on sale now (`/kampanyalar`). Read through Query and the
 * price read the storefront's own price comes from.
 */

type Maybe<T> = T | null | undefined

/**
 * A product as the index reads it for its prices: the variants its price
 * is the lowest of (a dated product's paying categories only, adr/0077 §5).
 */
export interface PricedSource {
  id: string
  published: boolean
  variant_ids: readonly string[]
}

export interface IndexedPrices {
  /** By `region_id:currency`, whole units with decimals. */
  prices: Record<string, number>
  on_sale: boolean
}

interface RegionPriced {
  id: string
  variants?: Maybe<
    Maybe<{ id?: string; calculated_price?: Maybe<{ calculated_amount?: Maybe<number> }> }>[]
  >
}

/** Each product's lowest selling price per region over its priced variants, for a shopper with no customer group. */
async function regionPrices(
  container: MedusaContainer,
  products: readonly PricedSource[]
): Promise<Map<string, Record<string, number>>> {
  const ids = products.map((product) => product.id)
  const priced = new Set(products.flatMap((product) => product.variant_ids))
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const { data: regions } = await query.graph({
    entity: "region",
    fields: ["id", "currency_code"],
  })
  const prices = new Map<string, Record<string, number>>()
  // An empty id filter is no filter: every product would be read
  for (const region of ids.length > 0 ? (regions as { id: string; currency_code: string }[]) : []) {
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "variants.id", "variants.calculated_price.calculated_amount"],
      filters: { id: ids },
      context: {
        variants: {
          calculated_price: QueryContext({
            currency_code: region.currency_code,
            region_id: region.id,
          }),
        },
      },
    })
    for (const product of data as RegionPriced[]) {
      const amounts = (product.variants ?? []).flatMap((variant) => {
        const amount = variant?.calculated_price?.calculated_amount
        return typeof amount === "number" && variant?.id && priced.has(variant.id) ? [amount] : []
      })
      if (amounts.length > 0) {
        const own = prices.get(product.id) ?? {}
        own[`${region.id}:${region.currency_code}`] = Math.min(...amounts)
        prices.set(product.id, own)
      }
    }
  }
  return prices
}

/** The shop currency's prices as the storefront shows them, when the product has a shown price. */
export function withShownPrice(
  prices: Readonly<Record<string, number>>,
  shown: ProductShown | undefined,
  currency: string = CURRENCY
): Record<string, number> {
  const lowest = shown?.lowest ?? null
  if (lowest === null) {
    return { ...prices }
  }
  const amount = Number(toMedusaAmount(lowest))
  return Object.fromEntries(
    Object.entries(prices).map(([key, value]) => [
      key,
      key.endsWith(`:${currency}`) ? amount : value,
    ])
  )
}

/** The index's prices and sale mark of these products; a draft's prices are Medusa's alone. */
export async function indexedPrices(
  container: MedusaContainer,
  products: readonly PricedSource[]
): Promise<Map<string, IndexedPrices>> {
  const [prices, shown] = await Promise.all([
    regionPrices(container, products),
    // A draft is listed nowhere: its shown price is not worked out
    productsShown(
      container,
      products.filter((product) => product.published)
    ),
  ])
  return new Map(
    products.map((product) => {
      const own = shown.get(product.id)
      return [
        product.id,
        {
          prices: withShownPrice(prices.get(product.id) ?? {}, own),
          on_sale: own?.on_sale ?? false,
        },
      ]
    })
  )
}
