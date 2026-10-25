import { keepPreviousData, queryOptions, useMutation, useQueryClient } from "@tanstack/react-query"
import type { Lifecycle } from "@/features/dashboard/api/overview"
import { sdk } from "@/lib/sdk"

export const ORDER_STAGES = [
  "all",
  "awaiting_payment",
  "to_ship",
  "shipped",
  "delivered",
  "canceled",
] as const
export type OrderStage = (typeof ORDER_STAGES)[number]

/** `GET /admin/order-board` (adr/0022): a recorded read of personal data. */
export interface BoardOrder {
  id: string
  display_id: number
  created_at: string
  currency_code: string
  total: string
  items: number
  stage: Lifecycle
  payment_status: string
  fulfillment_status: string
  customer: { name: string | null; place: string | null }
}

export interface OrderBoard {
  orders: BoardOrder[]
  count: number
  counts: Record<OrderStage, number>
  offset: number
  limit: number
  /** More orders than one read covers; the counts are of the newest ones. */
  limited: boolean
}

export interface OrderBoardParams {
  stage: OrderStage
  q: string
  page: number
}

export const ORDER_PAGE_SIZE = 20

export const orderBoardQuery = ({ stage, q, page }: OrderBoardParams) =>
  queryOptions({
    queryKey: ["orders", "board", { stage, q, page }],
    queryFn: () =>
      sdk.client.fetch<OrderBoard>("/admin/order-board", {
        query: { stage, offset: page * ORDER_PAGE_SIZE, ...(q ? { q } : {}) },
      }),
    placeholderData: keepPreviousData,
  })

// What the order page shows: the parcel, the money, who and where
const DETAIL_FIELDS = [
  "id",
  "display_id",
  "status",
  "created_at",
  "email",
  "currency_code",
  "subtotal",
  "shipping_total",
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
  "items.detail.fulfilled_quantity",
  "items.detail.shipped_quantity",
  "items.detail.delivered_quantity",
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
].join(",")

export const orderQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "detail", id],
    queryFn: async () => (await sdk.admin.order.retrieve(id, { fields: DETAIL_FIELDS })).order,
  })

export type OrderDetail = Awaited<ReturnType<typeof sdk.admin.order.retrieve>>["order"]

function useOrderMutation<T>(id: string, run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    onSuccess: async () => {
      await client.invalidateQueries({ queryKey: ["orders"] })
      await client.invalidateQueries({ queryKey: ["orders", "detail", id] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

type Items = { id: string; quantity: number }[]

/** Packs and hands the parcel to the carrier in one go: a fulfillment, then its shipment. */
export const useShipOrder = (id: string) =>
  useOrderMutation(id, async ({ items, notify }: { items: Items; notify: boolean }) => {
    const { order } = await sdk.admin.order.createFulfillment(
      id,
      {
        items,
        no_notification: !notify,
      },
      {
        fields:
          "fulfillments.id,fulfillments.created_at,fulfillments.shipped_at,fulfillments.canceled_at",
      }
    )
    // The newest fulfillment not yet shipped is the one just made
    const fulfillment = [...(order.fulfillments ?? [])]
      .filter((row) => !row.shipped_at && !row.canceled_at)
      .sort((a, b) => String(b.created_at).localeCompare(String(a.created_at)))[0]
    if (!fulfillment) {
      throw new Error("fulfillment missing")
    }
    await sdk.admin.order.createShipment(id, fulfillment.id, { items, no_notification: !notify })
  })

export const useMarkDelivered = (id: string) =>
  useOrderMutation(id, async (fulfillmentIds: string[]) => {
    for (const fulfillmentId of fulfillmentIds) {
      await sdk.admin.order.markAsDelivered(id, fulfillmentId)
    }
  })

export const useCancelOrder = (id: string) => useOrderMutation(id, () => sdk.admin.order.cancel(id))

export const useCapturePayment = (id: string) =>
  useOrderMutation(id, async (paymentIds: string[]) => {
    for (const paymentId of paymentIds) {
      await sdk.admin.payment.capture(paymentId, {})
    }
  })
