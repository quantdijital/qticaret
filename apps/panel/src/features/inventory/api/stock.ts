import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

export const STOCK_VIEWS = ["all", "low", "out"] as const
export type StockView = (typeof STOCK_VIEWS)[number]
export const STOCK_PAGE_SIZE = 25

/** `GET /admin/stock-board` (adr/0022): sellable stock across locations, low and sold-out first. */
export interface StockItem {
  id: string
  sku: string | null
  title: string | null
  available: number
  /** Its own low-stock threshold, else the shop's. */
  threshold: number
  levels: { location_id: string; stocked_quantity: number; reserved_quantity: number }[]
  variant: {
    id: string
    title: string | null
    product: { id: string; title: string; thumbnail: string | null } | null
  } | null
}

export interface StockBoard {
  items: StockItem[]
  count: number
  counts: Record<StockView, number>
  threshold: number
  limited: boolean
}

export const stockBoardQuery = ({ view, q, page }: { view: StockView; q: string; page: number }) =>
  queryOptions({
    queryKey: ["inventory", "board", { view, q, page }],
    queryFn: () =>
      sdk.client.fetch<StockBoard>("/admin/stock-board", {
        query: { view, offset: page * STOCK_PAGE_SIZE, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

export interface StockEdit {
  inventoryItemId: string
  quantity: number
  /** The item has a level at the location already: updated, else made. */
  hasLevel: boolean
}

/** Sets what is on the shelf at the shop's default location, for several items at once. */
export function useSetStock() {
  const client = useQueryClient()
  return useMutation({
    mutationFn: async ({ edits, locationId }: { edits: StockEdit[]; locationId: string }) => {
      const row = (edit: StockEdit) => ({
        inventory_item_id: edit.inventoryItemId,
        location_id: locationId,
        stocked_quantity: edit.quantity,
      })
      await sdk.admin.inventoryItem.batchInventoryItemsLocationLevels({
        create: edits.filter((edit) => !edit.hasLevel).map(row),
        update: edits.filter((edit) => edit.hasLevel).map(row),
      })
    },
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["inventory"] })
      await client.invalidateQueries({ queryKey: ["products"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}
