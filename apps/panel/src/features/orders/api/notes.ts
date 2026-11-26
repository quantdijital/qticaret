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
  /** Whether it was e-mailed to the customer (Batch 9 / O3); null when it never was. */
  sent_to_customer?: "sent" | "pending" | "failed" | "skipped" | null
}

/** A new note, and whether it goes to the customer too ("Müşteriye gönder"). */
export interface NewOrderNote {
  body: string
  notifyCustomer: boolean
}

/**
 * How the note's e-mail went: `sent` (or `duplicate`), else why not
 * (`template_off`: the shop turned the message off; `not_sent`: no address);
 * null when it was not asked for.
 */
export type NoteSendOutcome = string | null

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
    mutationFn: (note: NewOrderNote) =>
      sdk.client.fetch<{ note: { id: string }; sent?: NoteSendOutcome }>(
        `/admin/orders/${encodeURIComponent(orderId)}/notes`,
        {
          method: "POST",
          body: { body: note.body, ...(note.notifyCustomer ? { notify_customer: true } : {}) },
        }
      ),
    onSuccess: async (_answer, note) => {
      await client.invalidateQueries({ queryKey: keyOf(orderId) })
      // A note sent to the customer is in the order's message history too
      if (note.notifyCustomer) {
        await client.invalidateQueries({ queryKey: ["messages"] })
      }
    },
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
