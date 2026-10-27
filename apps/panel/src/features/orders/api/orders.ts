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
  /** One customer's orders, for their page. */
  customerId?: string | undefined
}

export const ORDER_PAGE_SIZE = 20

export const orderBoardQuery = ({ stage, q, page, customerId }: OrderBoardParams) =>
  queryOptions({
    queryKey: ["orders", "board", { stage, q, page, customerId }],
    queryFn: () =>
      sdk.client.fetch<OrderBoard>("/admin/order-board", {
        query: {
          stage,
          offset: page * ORDER_PAGE_SIZE,
          ...(q ? { q } : {}),
          ...(customerId ? { customer_id: customerId } : {}),
        },
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

/** `GET /admin/order-board/:id`: the stage and what can be done next, worked out by the server. */
export interface OrderState {
  stage: Lifecycle
  /** A packed parcel to hand over (fulfillment_id), or what is left to pack; null: nothing. */
  ship: { fulfillment_id: string | null; items: { id: string; quantity: number }[] } | null
  deliver: string[]
  capture: string[]
  cancelable: boolean
}

export const orderStateQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "state", id],
    queryFn: () => sdk.client.fetch<OrderState>(`/admin/order-board/${encodeURIComponent(id)}`),
  })

/** One line of `GET /admin/orders/:id/money`: amounts as exact lira ("89.99"). */
export interface OrderMoneyLine {
  id: string
  kind: "item" | "shipping"
  quantity: number
  /** Units that came back on returns. */
  returned: number
  gross: string
  /** The line's share of the order's discounts. */
  discount: string
  /** What the line was paid. */
  net: string
  returned_net: string
  /** Units given back by money refunds (F5 V5), and what those refunds gave back. */
  refunded_units: number
  refunded_net: string
}

export interface MoneyTotals {
  gross: string
  discount: string
  net: string
}

export interface OrderMoney extends MoneyTotals {
  currency_code: string
  lines: OrderMoneyLine[]
  items: MoneyTotals
  shipping: MoneyTotals
  /** Paid with gift cards and store credit (F4.8), outside the payment. */
  credit: string
  paid: string
  refunded: string
  /** What a refund can still give back: taken less refunded. */
  refundable: string
}

/**
 * `GET /admin/orders/:id/money` (F4.7): each line's discount share and
 * payment to the kuruş, worked out by the server, and what is refundable.
 */
export const orderMoneyQuery = (id: string) =>
  queryOptions({
    queryKey: ["orders", "money", id],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ money: OrderMoney }>(
          `/admin/orders/${encodeURIComponent(id)}/money`
        )
      ).money,
  })

function useOrderMutation<T>(run: (input: T) => Promise<unknown>) {
  const client = useQueryClient()
  return useMutation({
    mutationFn: run,
    // Settled, not only succeeded: a step that half-failed must not leave the page stale
    onSettled: async () => {
      await client.invalidateQueries({ queryKey: ["orders"] })
      await client.invalidateQueries({ queryKey: ["dashboard"] })
    },
  })
}

/** Packs what is left (or a packed parcel) and hands it over, as one step on the server. */
export const useShipOrder = (id: string) =>
  useOrderMutation(({ notify }: { notify: boolean }) =>
    sdk.client.fetch(`/admin/orders/${encodeURIComponent(id)}/ship`, {
      method: "POST",
      body: { notify },
    })
  )

export const useMarkDelivered = (id: string) =>
  useOrderMutation(async (fulfillmentIds: string[]) => {
    for (const fulfillmentId of fulfillmentIds) {
      await sdk.admin.order.markAsDelivered(id, fulfillmentId)
    }
  })

export const useCancelOrder = (id: string) => useOrderMutation(() => sdk.admin.order.cancel(id))

/** A money refund: units of lines (and the shipping), or a free amount in lira. */
export interface RefundRequest {
  items?: { id: string; quantity: number }[]
  shipping?: boolean
  amount?: number
}

export interface RefundPreview {
  /** Lira, exact ("120.00"). */
  amount: string
  refundable: string
}

/** What a refund would give back, worked out by the server; nothing is changed. */
export const refundPreviewQuery = (id: string, request: RefundRequest | null) =>
  queryOptions({
    queryKey: ["orders", "refund-preview", id, request],
    queryFn: async () =>
      (
        await sdk.client.fetch<{ refund: RefundPreview }>(
          `/admin/orders/${encodeURIComponent(id)}/refunds/preview`,
          { method: "POST", body: request ?? {} }
        )
      ).refund,
    enabled: request !== null,
    retry: false,
  })

/** Gives the money back; `reference` makes a refund tried again happen once. */
export const useRefundOrder = (id: string) =>
  useOrderMutation((body: RefundRequest & { reference: string; note?: string }) =>
    sdk.client.fetch(`/admin/orders/${encodeURIComponent(id)}/refunds`, { method: "POST", body })
  )

export const useCapturePayment = () =>
  useOrderMutation(async (paymentIds: string[]) => {
    for (const paymentId of paymentIds) {
      await sdk.admin.payment.capture(paymentId, {})
    }
  })
