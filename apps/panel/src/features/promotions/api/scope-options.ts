import { queryOptions } from "@tanstack/react-query"
import type { PickerOption } from "@/components/patterns/search-picker"
import { sdk } from "@/lib/sdk"

/** What a promotion's scope picks from (F4.4): the shop's collections and products. */

// A shop's collections fit one read
const COLLECTIONS_READ = 200
const PRODUCT_RESULTS = 20

export const collectionsQuery = () =>
  queryOptions({
    queryKey: ["promotions", "collections"],
    queryFn: async () =>
      (
        await sdk.admin.productCollection.list({
          fields: "id,title",
          limit: COLLECTIONS_READ,
          order: "title",
        })
      ).collections,
    staleTime: 5 * 60_000,
  })

/** The names of the products a promotion names, for its chips. */
export const productNamesQuery = (ids: readonly string[]) =>
  queryOptions({
    queryKey: ["promotions", "product-names", [...ids].sort()],
    queryFn: async () =>
      ids.length === 0
        ? []
        : (await sdk.admin.product.list({ id: [...ids], fields: "id,title", limit: ids.length }))
            .products,
    enabled: ids.length > 0,
  })

export async function searchProducts(q: string): Promise<PickerOption[]> {
  const { products } = await sdk.admin.product.list({
    fields: "id,title",
    limit: PRODUCT_RESULTS,
    ...(q ? { q } : {}),
  })
  return products.map((product) => ({ id: product.id, label: product.title }))
}
