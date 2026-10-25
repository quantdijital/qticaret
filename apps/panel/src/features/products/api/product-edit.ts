import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Saving what the product page edits beyond the product's own fields. */

export const PRODUCT_CONDITIONS = ["new", "refurbished", "used", "damaged"] as const
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number]

/** `GET /admin/products/:id/catalog` (F3.1). */
export interface ProductCatalog {
  condition: ProductCondition
  kind: "physical" | "digital" | "service"
  primary_category_id: string | null
  successor: { id: string; title: string; handle: string } | null
  categories: { id: string; name: string }[]
  variants: {
    id: string
    title: string | null
    sku: string | null
    mpn: string | null
    gtin: string | null
  }[]
}

const catalogUrl = (id: string) => `/admin/products/${id}/catalog`

export const productCatalogQuery = (id: string) =>
  queryOptions({
    queryKey: ["products", "catalog", id],
    queryFn: () => sdk.client.fetch<ProductCatalog>(catalogUrl(id)),
  })

export function useSaveCatalog(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: { condition?: ProductCondition; primary_category_id?: string | null }) =>
      sdk.client.fetch<ProductCatalog>(catalogUrl(id), { method: "POST", body }),
    onSuccess: (catalog) => {
      client.setQueryData(["products", "catalog", id], catalog)
    },
  })
}

export interface VariantEdit {
  variantId: string
  /** The variant's prices as stored; the TRY one is replaced, the rest kept. */
  prices: { id: string; currency_code: string; amount: number }[]
  amount: number
  /** Null for a variant whose stock is not tracked. */
  stock: { inventoryItemId: string; quantity: number; hasLevel: boolean } | null
}

const CURRENCY = "try"

function nextPrices(edit: VariantEdit) {
  const others = edit.prices.filter((price) => price.currency_code !== CURRENCY)
  const current = edit.prices.find((price) => price.currency_code === CURRENCY)
  return [
    ...others.map(({ id, currency_code, amount }) => ({ id, currency_code, amount })),
    { ...(current ? { id: current.id } : {}), currency_code: CURRENCY, amount: edit.amount },
  ]
}

/**
 * Prices in one variant batch, then stock at the shop's default location
 * in one level batch: a level that is there is updated, a missing one made.
 */
export function useSaveVariants(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({
      edits,
      locationId,
    }: {
      edits: VariantEdit[]
      locationId: string | null
    }) => {
      if (edits.length === 0) {
        return
      }
      await sdk.admin.product.batchVariants(productId, {
        update: edits.map((edit) => ({ id: edit.variantId, prices: nextPrices(edit) })),
      })
      const stocked = edits.flatMap((edit) => (edit.stock ? [edit.stock] : []))
      if (locationId && stocked.length > 0) {
        const row = (stock: (typeof stocked)[number]) => ({
          inventory_item_id: stock.inventoryItemId,
          location_id: locationId,
          stocked_quantity: stock.quantity,
        })
        await sdk.admin.inventoryItem.batchInventoryItemsLocationLevels({
          create: stocked.filter((stock) => !stock.hasLevel).map(row),
          update: stocked.filter((stock) => stock.hasLevel).map(row),
        })
      }
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
