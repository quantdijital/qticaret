import { z } from "@medusajs/framework/zod"
import { ValidationError } from "../../errors"
import type { MigrationSource } from "../types"
import { bulkNodes } from "./bulk"
import type { BulkOptions } from "./bulk"
import { brandsOf, categoriesOf, productsOf } from "./catalog"
import type { ShopifyApi } from "./client"
import { customersOf, ordersOf, pagesOf } from "./people"
import {
  BLOGS_QUERY,
  COLLECTIONS_QUERY,
  CUSTOMERS_QUERY,
  ORDERS_QUERY,
  PAGES_QUERY,
  PRODUCTS_QUERY,
  SHOP_QUERY,
} from "./queries"

const Shop = z.object({ shop: z.object({ currencyCode: z.string().max(3) }) })

/** Loads once, however many lists ask for it (the products give the brands too). */
function once<T>(load: () => Promise<T>): () => Promise<T> {
  let loading: Promise<T> | null = null
  return () => (loading ??= load())
}

const listOf =
  <T>(load: () => Promise<readonly T[]>) =>
  (): AsyncIterable<T> => ({
    [Symbol.asyncIterator]: () => {
      let values: Iterator<T> | null = null
      return {
        next: async () => {
          values ??= (await load()).values()
          return values.next()
        },
      }
    },
  })

/**
 * A Shopify store as a migration source (F14.2, adr/0042 §10): each list
 * a bulk query, run when the migration reaches it. Prices move as the
 * shop set them, never converted: a store selling in another currency is
 * refused before anything is read. Shopify keeps no reviews of its own
 * (an app's come through a bundle).
 */
export async function openShopifySource(
  api: ShopifyApi,
  shopDomain: string,
  options: BulkOptions
): Promise<MigrationSource> {
  const { shop } = await api.graphql(SHOP_QUERY, {}, Shop, { read: true })
  if (shop.currencyCode !== "TRY") {
    throw new ValidationError("migration.shopify_currency")
  }
  const run = (query: string) => bulkNodes(api, query, options)
  const products = once(async () => productsOf(await run(PRODUCTS_QUERY)))
  return {
    id: `shopify:${shopDomain}`,
    categories: listOf(async () => categoriesOf(await run(COLLECTIONS_QUERY))),
    brands: listOf(async () => brandsOf(await products())),
    products: listOf(products),
    customers: listOf(async () => customersOf(await run(CUSTOMERS_QUERY))),
    orders: listOf(async () => ordersOf(await run(ORDERS_QUERY))),
    reviews: listOf(() => Promise.resolve([])),
    pages: listOf(async () => pagesOf(await run(PAGES_QUERY), await run(BLOGS_QUERY))),
  }
}
