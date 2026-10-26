import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The stock ledger (F3.8, adr/0020) as the panel reads it. */

export const MOVEMENT_REASONS = [
  "manual",
  "import",
  "bulk_edit",
  "order",
  "return",
  "cancel",
  "reconcile",
  "unknown",
] as const
export type MovementReason = (typeof MOVEMENT_REASONS)[number]

export interface StockMovement {
  id: string
  created_at: string
  location_id: string
  location_name: string | null
  delta_stocked: number
  stocked_after: number
  delta_reserved: number
  reserved_after: number
  reason: MovementReason
  /** The order (`order_…`) or job the change came from. */
  reference: string | null
}

export interface StockWatch {
  /** The item's own threshold; null follows the shop's. */
  threshold: number | null
  fallback: number
}

export const MOVEMENTS_PAGE = 20

export const movementsQuery = (itemId: string, page: number) =>
  queryOptions({
    queryKey: ["inventory", "movements", itemId, page],
    queryFn: () =>
      sdk.client.fetch<{ movements: StockMovement[]; count: number }>(
        `/admin/stock-items/${encodeURIComponent(itemId)}/movements`,
        { query: { limit: MOVEMENTS_PAGE, offset: page * MOVEMENTS_PAGE } }
      ),
    placeholderData: keepPreviousData,
  })

export const watchQuery = (itemId: string) =>
  queryOptions({
    queryKey: ["inventory", "watch", itemId],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ watch: StockWatch }>(
          `/admin/stock-items/${encodeURIComponent(itemId)}/watch`
        )
      ).watch,
  })

export function useSaveWatch(itemId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (threshold: number | null) =>
      sdk.client.fetch<{ watch: StockWatch }>(
        `/admin/stock-items/${encodeURIComponent(itemId)}/watch`,
        { method: "POST", body: { threshold } }
      ),
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["inventory"] })
    },
  })
}
