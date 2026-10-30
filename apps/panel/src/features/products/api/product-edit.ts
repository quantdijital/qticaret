import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** Saving what the product page edits beyond the product's own fields. */

export const PRODUCT_CONDITIONS = ["new", "refurbished", "used", "damaged"] as const
export type ProductCondition = (typeof PRODUCT_CONDITIONS)[number]

/** F3.2: digital and service products need no shipping (flag `catalog.non_physical`). */
export const PRODUCT_KINDS = ["physical", "digital", "service"] as const
export type ProductKind = (typeof PRODUCT_KINDS)[number]

/** `GET /admin/products/:id/catalog` (F3.1). */
export interface ProductCatalog {
  condition: ProductCondition
  kind: ProductKind
  primary_category_id: string | null
  /** Outside the right of withdrawal (F13.4): returned only when faulty. */
  withdrawal_excluded: boolean
  successor: { id: string; title: string; handle: string } | null
  categories: { id: string; name: string }[]
  variants: {
    id: string
    title: string | null
    sku: string | null
    mpn: string | null
    /** Unit cost in lira, VAT excluded (F11.4); staff only. */
    cost: number | null
    gtin: string | null
  }[]
}

const catalogUrl = (id: string) => `/admin/products/${encodeURIComponent(id)}/catalog`

export const productCatalogQuery = (id: string) =>
  queryOptions({
    queryKey: ["products", "catalog", id],
    queryFn: () => sdk.client.fetch<ProductCatalog>(catalogUrl(id)),
  })

export function useSaveCatalog(id: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: {
      condition?: ProductCondition
      kind?: ProductKind
      primary_category_id?: string | null
      withdrawal_excluded?: boolean
    }) => sdk.client.fetch<ProductCatalog>(catalogUrl(id), { method: "POST", body }),
    onSuccess: async (catalog) => {
      client.setQueryData(["products", "catalog", id], catalog)
      // A kind change moves the product's shipping set-up and what its page asks for
      await client.invalidateQueries({ queryKey: ["products", "detail", id] })
    },
  })
}

export interface VariantEdit {
  variantId: string
  /** The variant's prices as stored; the TRY one is replaced, the rest kept. */
  prices: { id: string; currency_code: string; amount: number }[]
  /** The new TRY price; null leaves the prices alone. */
  amount: number | null
  /** Null for a variant whose stock is not tracked. */
  stock: { inventoryItemId: string; quantity: number; hasLevel: boolean } | null
  /** Whether it sells past its stock (preorder); null leaves it alone. */
  backorder: boolean | null
  /** The unit cost in lira (F11.4); null clears it, undefined leaves it alone. */
  cost?: number | null
}

const CURRENCY = "try"

function nextPrices(edit: VariantEdit) {
  const others = edit.prices.filter((price) => price.currency_code !== CURRENCY)
  const current = edit.prices.find((price) => price.currency_code === CURRENCY)
  return [
    ...others.map(({ id, currency_code, amount }) => ({ id, currency_code, amount })),
    { ...(current ? { id: current.id } : {}), currency_code: CURRENCY, amount: edit.amount ?? 0 },
  ]
}

/**
 * Stock at the shop's default location in one level batch (a level that is
 * there is updated, a missing one made), then prices and preorder in one
 * variant batch. Stock goes first: a variant turned to preorder gets an
 * empty level from the server, which would collide with a level made here.
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
      const update = edits.flatMap((edit) =>
        edit.amount === null && edit.backorder === null
          ? []
          : [
              {
                id: edit.variantId,
                ...(edit.amount === null ? {} : { prices: nextPrices(edit) }),
                ...(edit.backorder === null ? {} : { allow_backorder: edit.backorder }),
              },
            ]
      )
      if (update.length > 0) {
        await sdk.admin.product.batchVariants(productId, { update })
      }
      // Unit costs are the catalog's (F11.4), saved last: a refused price leaves them as they were
      const costs = edits.flatMap((edit) =>
        edit.cost === undefined ? [] : [[edit.variantId, { cost: edit.cost }] as const]
      )
      if (costs.length > 0) {
        await sdk.client.fetch(catalogUrl(productId), {
          method: "POST",
          body: { variants: Object.fromEntries(costs) },
        })
      }
    },
    // A save that failed half-way (stock written, prices refused) still changed the product
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
