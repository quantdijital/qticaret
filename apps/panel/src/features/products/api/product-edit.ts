import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { JSONContent } from "@tiptap/react"
import type { Restriction } from "@/features/categories/api/restrictions"
import type { ProductAddonTemplate } from "@/features/products/api/addon-templates"
import type { AddonInput, ProductAddon } from "@/features/products/api/addons"
import type { BookingMode } from "@/features/products/api/booking"
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
  /** Sold to adults only, and why (F13.4); a category's mark is not shown here. */
  restriction: Restriction | null
  /** Its variants are gift card amounts (adr/0025 Ek 2026-11-03); marked, it is digital. */
  is_gift_card: boolean
  /** Sold by departure (adr/0076 §2); absent from an older backend: none. */
  booking_mode?: BookingMode
  /** Its own card badge ("Sınırlı"), shown while the shop has them on; absent from an older backend: none. */
  badge?: string | null
  /** Paid or free add-ons a shopper picks beside the variant (adr/0052), in the shop's order. */
  addons: ProductAddon[]
  /** Add-on templates it reaches, live (adr/0052 Ek 2026-11-23); absent from an older backend: none. */
  addon_templates?: ProductAddonTemplate[]
  /** Add-ons past the limit of five, not shown to shoppers (its attribute template changed). */
  addons_hidden?: number
  /**
   * The long description as a document (ADR-0055): headings, lists, quotes,
   * tables; null while the product has only its plain text.
   */
  description_doc: JSONContent | null
  /**
   * The short description as the shop wrote it, shown under the product's
   * name above the price (ADR-0055 Ek 2026-11-06): paragraphs, h3–h4,
   * lists, bold, italic, links; null while it has none.
   */
  summary_doc: JSONContent | null
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
      restriction?: Restriction | null
      is_gift_card?: boolean
      /** Dated sale on or off; another kind needs `none` in the same save (adr/0076 Ek). */
      booking_mode?: "none" | "departure"
      /** Its own card badge; null or empty clears it (the server cuts and checks it). */
      badge?: string | null
      /** The whole list, ids kept; null clears it. */
      addons?: AddonInput[] | null
      /** The description as a document; the server writes its plain text too (ADR-0055). */
      description_doc?: JSONContent | null
      /** The short description as a document (1,500 characters at most); null or an empty one clears it. */
      summary_doc?: JSONContent | null
    }) => sdk.client.fetch<ProductCatalog>(catalogUrl(id), { method: "POST", body }),
    onSuccess: async (catalog) => {
      client.setQueryData(["products", "catalog", id], catalog)
      // A kind change moves the product's shipping set-up and what its page asks for; a
      // description saved as a document rewrites the product's plain text
      await client.invalidateQueries({ queryKey: ["products", "detail", id] })
      // Dated sale turned on or off: its settings and departures (adr/0076 §9)
      await client.invalidateQueries({ queryKey: ["products", "booking", id] })
    },
  })
}

/** A variant's own codes as Medusa keeps them: absent leaves one alone, null clears it. */
export interface VariantCodes {
  sku?: string | null
  ean?: string | null
  upc?: string | null
  barcode?: string | null
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
  /** Its SKU and barcode (GTIN); null leaves them alone. */
  codes?: VariantCodes | null
  /** Its manufacturer part number, kept by the catalog; null clears it, undefined leaves it alone. */
  mpn?: string | null
  /**
   * Its own parcel measures, in the shop's units (a variant without them
   * takes the product's); only the changed ones, null clears one.
   */
  measures?: VariantMeasures | null
}

export interface VariantMeasures {
  weight?: number | null
  length?: number | null
  width?: number | null
  height?: number | null
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
 * there is updated, a missing one made), then prices, preorder, codes and
 * measures in one variant batch, then unit costs and MPNs in the catalog.
 * Stock goes first: a variant turned to preorder gets an empty level from
 * the server, which would collide with a level made here.
 */
export async function saveVariantEdits(
  productId: string,
  { edits, locationId }: { edits: VariantEdit[]; locationId: string | null }
): Promise<void> {
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
    edit.amount === null && edit.backorder === null && !edit.codes && !edit.measures
      ? []
      : [
          {
            id: edit.variantId,
            ...(edit.amount === null ? {} : { prices: nextPrices(edit) }),
            ...(edit.backorder === null ? {} : { allow_backorder: edit.backorder }),
            ...edit.codes,
            ...edit.measures,
          },
        ]
  )
  if (update.length > 0) {
    await sdk.admin.product.batchVariants(productId, { update })
  }
  // Unit costs (F11.4) and MPNs are the catalog's, saved last: a refused price leaves them
  const catalog = edits.flatMap((edit) =>
    edit.cost === undefined && edit.mpn === undefined
      ? []
      : [
          [
            edit.variantId,
            {
              ...(edit.cost === undefined ? {} : { cost: edit.cost }),
              ...(edit.mpn === undefined ? {} : { mpn: edit.mpn }),
            },
          ] as const,
        ]
  )
  if (catalog.length > 0) {
    await sdk.client.fetch(catalogUrl(productId), {
      method: "POST",
      body: { variants: Object.fromEntries(catalog) },
    })
  }
}

/** `saveVariantEdits` as a mutation, the product and what depends on it read again after. */
export function useSaveVariants(productId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (input: { edits: VariantEdit[]; locationId: string | null }) =>
      saveVariantEdits(productId, input),
    // A save that failed half-way (stock written, prices refused) still changed the product;
    // prices and codes change what the SEO advisor finds
    onSettled: async () => {
      await Promise.all([
        client.invalidateQueries({ queryKey: ["products"] }),
        client.invalidateQueries({ queryKey: ["dashboard"] }),
        client.invalidateQueries({ queryKey: ["seo"] }),
      ])
    },
  })
}
