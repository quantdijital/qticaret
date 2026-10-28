import { useMutation } from "@tanstack/react-query"
import { useOrderMutation } from "@/features/orders/api/orders"
import { sdk } from "@/lib/sdk"

/**
 * A parcel's label (F7, adr/0031): the server answers a short-lived link to
 * the PDF in private storage; reading it is logged.
 */
export const useLabelLink = (orderId: string) =>
  useMutation({
    mutationFn: async (fulfillmentId: string) =>
      (
        await sdk.client.fetch<{ url: string }>(
          `/admin/orders/${encodeURIComponent(orderId)}/fulfillments/${encodeURIComponent(fulfillmentId)}/label`
        )
      ).url,
  })

/** One order's outcome of "Kargoya ver" for several (F7.7). */
export interface ShipResult {
  order_id: string
  ok: boolean
  carrier: "geliver" | null
  /** A carrier's parcel waiting for its pickup: its label to print. */
  fulfillment_id: string | null
  /** Why it was not shipped: its key, and the sentence to show. */
  error: string | null
  message: string | null
}

/** The most orders one "Kargoya ver" takes (the server's limit). */
export const MAX_BULK_SHIP = 20

export const useShipOrders = () =>
  useOrderMutation(
    async ({ orderIds, notify }: { orderIds: string[]; notify: boolean }) =>
      (
        await sdk.client.fetch<{ results: ShipResult[] }>("/admin/order-board/ship", {
          method: "POST",
          body: { order_ids: orderIds, notify },
        })
      ).results
  )
