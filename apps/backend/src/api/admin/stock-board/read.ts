import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { createSingleFlight } from "../../../lib/cache"
import { stockSlice } from "../../../lib/dashboard"
import type { StockRow } from "../../../lib/dashboard"
import { lowStockThresholds } from "../../../lib/stock"
import { STOCK_BOARD_PAGE } from "./validators"
import type { AdminGetStockBoardType } from "./validators"

// Stock records read at most (docs/04), as the dashboard's count; past this `limited`
const MAX_ITEMS_READ = 2000

// Views and pages asked at once share one read of the levels (docs/04)
const levelRead = createSingleFlight<{
  data: unknown[]
  metadata?: { count?: number } | undefined
}>()

interface Level {
  location_id: string
  stocked_quantity?: number | null
  reserved_quantity?: number | null
}

interface ItemRow {
  id: string
  sku: string | null
  title: string | null
  location_levels?: (Level | null)[] | null
  variants?:
    | ({
        id: string
        title: string | null
        product?: { id: string; title: string; thumbnail: string | null } | null
      } | null)[]
    | null
}

/**
 * The stock list (adr/0022). Sellable stock spans locations and the views
 * hang on it, so the newest MAX_ITEMS_READ items are sorted here; only the
 * page's items are read with their variant and product.
 */
export async function readStockBoard(scope: MedusaContainer, params: AdminGetStockBoardType) {
  const query = scope.resolve(ContainerRegistrationKeys.QUERY)
  const { data, metadata } = await levelRead(params.q ?? "", () =>
    query.graph({
      entity: "inventory_item",
      fields: ["id", "location_levels.stocked_quantity", "location_levels.reserved_quantity"],
      // Medusa's search over the item's searchable fields (SKU, title); its filter type leaves `q` out
      filters: (params.q ? { q: params.q } : {}) as Record<string, never>,
      pagination: { skip: 0, take: MAX_ITEMS_READ, order: { created_at: "DESC" } },
    })
  )
  const rows = data as unknown as StockRow[]
  const thresholds = await lowStockThresholds(
    scope,
    rows.map((row) => row.id)
  )
  const slice = stockSlice(rows, params.view, params.offset, STOCK_BOARD_PAGE, thresholds.of)
  const ids = slice.page.map((row) => row.id)
  const { data: full } = ids.length
    ? await query.graph({
        entity: "inventory_item",
        fields: [
          "id",
          "sku",
          "title",
          "location_levels.location_id",
          "location_levels.stocked_quantity",
          "location_levels.reserved_quantity",
          "variants.id",
          "variants.title",
          "variants.product.id",
          "variants.product.title",
          "variants.product.thumbnail",
        ],
        filters: { id: ids },
      })
    : { data: [] }
  const byId = new Map((full as unknown as ItemRow[]).map((item) => [item.id, item]))
  return {
    items: slice.page.flatMap(({ id, available }) => {
      const item = byId.get(id)
      if (!item) {
        return []
      }
      const variant = item.variants?.find(Boolean) ?? null
      return [
        {
          id,
          sku: item.sku,
          title: item.title,
          available,
          threshold: thresholds.of(id),
          levels: (item.location_levels ?? []).flatMap((level) =>
            level
              ? [
                  {
                    location_id: level.location_id,
                    stocked_quantity: level.stocked_quantity ?? 0,
                    reserved_quantity: level.reserved_quantity ?? 0,
                  },
                ]
              : []
          ),
          variant: variant
            ? { id: variant.id, title: variant.title, product: variant.product ?? null }
            : null,
        },
      ]
    }),
    count: slice.count,
    counts: slice.counts,
    threshold: thresholds.fallback,
    offset: params.offset,
    limit: STOCK_BOARD_PAGE,
    limited: (metadata?.count ?? rows.length) > rows.length,
  }
}

export type StockBoard = Awaited<ReturnType<typeof readStockBoard>>
