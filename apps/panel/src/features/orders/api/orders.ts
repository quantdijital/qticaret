import { queryOptions } from "@tanstack/react-query"
import type { Lifecycle } from "@/features/dashboard/api/overview"
import { cancelOrder } from "@/features/orders/api/cancel"
import { useOrderMutation } from "@/features/orders/api/mutation"
import { sdk } from "@/lib/sdk"

export * from "@/features/orders/api/board"
export * from "@/features/orders/api/money"
export { useOrderMutation } from "@/features/orders/api/mutation"

// What the order page shows: the parcel, the money, who and where
const DETAIL_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "currency_code",
  // Where it came from: a payment link's id (adr/0051) in `qt_payment_link`
  "metadata",
  // Tax included and before discounts, as the shop priced them; the discount is its own row
  "original_item_total",
  "original_shipping_total",
  "discount_total",
  "tax_total",
  "total",
  "items.id",
  "items.title",
  "items.subtitle",
  "items.thumbnail",
  "items.variant_sku",
  "items.product_id",
  "items.quantity",
  "items.unit_price",
  "items.total",
  "items.detail.quantity",
  // A price an order edit corrected reaches the item only with it (adr/0033)
  "items.detail.unit_price",
  "items.detail.fulfilled_quantity",
  "items.detail.shipped_quantity",
  "items.detail.delivered_quantity",
  // A gift card line's recipient and issued cards (adr/0025 Ek 2026-11-03)
  "items.metadata",
  "customer.id",
  "customer.first_name",
  "customer.last_name",
  "customer.email",
  "customer.phone",
  "shipping_address.*",
  "billing_address.*",
  "shipping_methods.id",
  "shipping_methods.name",
  "shipping_methods.amount",
  "payment_collections.id",
  "payment_collections.status",
  "payment_collections.amount",
  "payment_collections.captured_amount",
  "payment_collections.refunded_amount",
  "payment_collections.payments.id",
  "payment_collections.payments.amount",
  "payment_collections.payments.provider_id",
  "payment_collections.payments.captured_at",
  "payment_collections.payments.canceled_at",
  "fulfillments.id",
  "fulfillments.created_at",
  "fulfillments.packed_at",
  "fulfillments.shipped_at",
  "fulfillments.delivered_at",
  "fulfillments.canceled_at",
  "fulfillments.labels.tracking_number",
  "fulfillments.labels.tracking_url",
].join(",")

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "detail", id],
    queryFn: async () => (await sdk.admin.order.retrieve(id, { fields: DETAIL_FIELDS })).order,
  })

export type OrderDetail = Awaited<ReturnType<typeof sdk.admin.order.retrieve>>["order"]

/** `GET /admin/order-board/:id`: the stage and what can be done next, worked out by the server. */
export interface OrderState {
  stage: Lifecycle
  /**
   * A packed parcel to hand over (fulfillment_id), or what is left to pack;
   * beside a packed parcel, the lines no parcel holds yet (`rest`). Null: nothing.
   */
  ship: {
    fulfillment_id: string | null
    items: { id: string; quantity: number }[]
    rest?: { id: string; quantity: number }[]
  } | null
  /** Parcels packed with a carrier's label, waiting for its pickup (adr/0031). */
  pickup: string[]
  deliver: string[]
  capture: string[]
  cancelable: boolean
  /** It goes with a carrier in test mode: an order paid in test mode may still ship that way. */
  test_carrier: boolean
  /** The invoice provider holds the buyer: the billing address no longer changes. */
  billing_locked: boolean
  /**
   * BirFatura's cargo module makes the labels (adr/0072 Ek 2026-11-26): the
   * order ships when its tracking comes back, or by hand with one typed in.
   * Absent from an older backend: false.
   */
  birfatura_ships?: boolean
}

export const orderStateQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "state", id],
    queryFn: () => sdk.client.fetch<OrderState>(`/admin/order-board/${encodeURIComponent(id)}`),
  })

/**
 * Packs what is left, a part of it (F7.10), or a packed parcel, and hands
 * it over, as one step on the server; with a carrier, its label is bought.
 * A packed parcel and the lines beside it go one after the other: the
 * packed one first (no lines named), then a parcel of the others.
 */
export const useShipOrder = (id: string) =>
  useOrderMutation(
    async ({
      notify,
      packed = false,
      items,
      tracking,
    }: {
      notify: boolean
      /** The packed parcel goes, whole. */
      packed?: boolean
      /** Lines for a new parcel; none (and nothing packed): all that is left. */
      items?: { id: string; quantity: number }[] | undefined
      /** The shop's own parcel's carrier and tracking (F18). */
      tracking?: { carrier: string; number: string; url: string | null } | undefined
    }) => {
      const send = (lines?: { id: string; quantity: number }[]) =>
        sdk.client.fetch(`/admin/orders/${encodeURIComponent(id)}/ship`, {
          method: "POST",
          body: { notify, ...(lines ? { items: lines } : {}), ...(tracking ? { tracking } : {}) },
        })
      if (packed) {
        await send()
      }
      if (!packed || items) {
        await send(items)
      }
    }
  )

export const useMarkDelivered = (id: string) =>
  useOrderMutation(async (fulfillmentIds: string[]) => {
    for (const fulfillmentId of fulfillmentIds) {
      await sdk.admin.order.markAsDelivered(id, fulfillmentId)
    }
  })

export const useCancelOrder = (id: string) => useOrderMutation(() => cancelOrder(id))
