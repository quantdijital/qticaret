import { queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** The longest note the server takes (F12.8). */
export const ORDER_NOTE_MAX = 2000

/** A staff member's note on an order (F12.8); the shopper never sees it. */
export interface OrderNote {
  id: string
  body: string
  created_at: string
  /** Null when the author has left the team. */
  author: { id: string; name: string } | null
  /** Whether the signed-in staff member may remove it: their own, or any for the owner. */
  deletable: boolean
}

const keyOf = (orderId: string) => ["orders", orderId, "notes"] as const

export const orderNotesQuery = (orderId: string) =>
  queryOptions({
    queryKey: keyOf(orderId),
    queryFn: () =>
      sdk.client.fetch<{ notes: OrderNote[] }>(
        `/admin/orders/${encodeURIComponent(orderId)}/notes`
      ),
  })

export function useAddOrderNote(orderId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (body: string) =>
      sdk.client.fetch<{ note: { id: string } }>(
        `/admin/orders/${encodeURIComponent(orderId)}/notes`,
        { method: "POST", body: { body } }
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keyOf(orderId) }),
  })
}

export function useRemoveOrderNote(orderId: string) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: (noteId: string) =>
      sdk.client.fetch(
        `/admin/orders/${encodeURIComponent(orderId)}/notes/${encodeURIComponent(noteId)}`,
        { method: "DELETE" }
      ),
    onSuccess: () => client.invalidateQueries({ queryKey: keyOf(orderId) }),
  })
}
