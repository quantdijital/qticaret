import { useOrderMutation } from "@/features/orders/api/orders"
import { sdk } from "@/lib/sdk"

/** One order's outcome of "Kargoya ver" for several (F7.7). */
export interface ShipResult {
  order_id: string
  ok: boolean
  /** The carrier asked for the label: Geliver or the shop's own contract (adr/0035). */
  carrier: "geliver" | "aras" | "yurtici" | null
  /** A carrier's parcel waiting for its pickup: its label to print. */
  fulfillment_id: string | null
  /** Why it was not shipped: its key, and the sentence to show. */
  error: string | null
  message: string | null
}

/** The most orders one "Kargoya ver" takes (the server's limit). */
export const MAX_BULK_SHIP = 20

/** One order's outcome of "Teslim edildi" for several (F12.3). */
export interface DeliverResult {
  order_id: string
  ok: boolean
  delivered: number
  error: string | null
  message: string | null
}

/** "Teslim edildi" for the picked orders: the shop's own deliveries, each whole. */
export const useDeliverOrders = () =>
  useOrderMutation(
    async (orderIds: string[]) =>
      (
        await sdk.client.fetch<{ results: DeliverResult[] }>("/admin/order-board/deliver", {
          method: "POST",
          body: { order_ids: orderIds },
        })
      ).results
  )

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

/**
 * The picked parcels' labels as one PDF to print (F7.7): an address for a
 * tab, made in the browser from the answer, and how many had no label.
 * The caller revokes the address once the tab has it.
 */
export async function bulkLabels(fulfillmentIds: readonly string[]) {
  const query = new URLSearchParams(fulfillmentIds.map((id) => ["fulfillment_id", id]))
  const response = await fetch(`/admin/shipping-labels?${query.toString()}`, {
    credentials: "same-origin",
  })
  if (!response.ok) {
    const body = (await response.json().catch(() => null)) as { message?: string } | null
    throw Object.assign(new Error("labels failed"), {
      status: response.status,
      message: body?.message ?? "",
    })
  }
  const missing = Number(response.headers.get("x-labels-missing") ?? "0")
  return { url: URL.createObjectURL(await response.blob()), missing }
}
