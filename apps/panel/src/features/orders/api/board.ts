import { keepPreviousData, queryOptions } from "@tanstack/react-query"
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
  /** The latest carrier parcel (adr/0031); null when none. */
  shipping: {
    status: ShipmentStatus
    tracking_number: string | null
    /** Its label's parcel, to print while it waits for the carrier. */
    fulfillment_id: string
  } | null
  /** How the shopper chose it to go; null when the order has no shipping. */
  delivery: {
    name: string
    /** A carrier that issues a label; null: the shop's own delivery or collection. */
    carrier: "geliver" | "aras" | "yurtici" | null
    pickup: boolean
  } | null
}

/** Where a carrier's parcel stands (adr/0031), as the server names it. */
export type ShipmentStatus =
  | "created"
  | "picked_up"
  | "in_transit"
  | "out_for_delivery"
  | "delivered"
  | "returned"
  | "failed"
  | "canceled"

export interface OrderBoard {
  orders: BoardOrder[]
  count: number
  counts: Record<OrderStage, number>
  offset: number
  limit: number
  /** More orders than one read covers; the counts are of the newest ones. */
  limited: boolean
}

/** Where the money stands, apart from the stage (F12.3). */
export const PAYMENT_FILTERS = ["paid", "awaiting", "refunded"] as const
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]

/** Where the parcel stands, apart from the stage (F12.3). */
export const SHIPPING_FILTERS = ["none", "label", "on_the_way", "delivered", "problem"] as const
export type ShippingFilter = (typeof SHIPPING_FILTERS)[number]

export interface OrderBoardParams {
  stage: OrderStage
  q: string
  page: number
  /** One customer's orders, for their page. */
  customerId?: string | undefined
  payment?: PaymentFilter | undefined
  shipping?: ShippingFilter | undefined
}

export const ORDER_PAGE_SIZE = 20

export const orderBoardQuery = ({
  stage,
  q,
  page,
  customerId,
  payment,
  shipping,
}: OrderBoardParams) =>
  queryOptions({
    queryKey: ["orders", "board", { stage, q, page, customerId, payment, shipping }],
    queryFn: () =>
      sdk.client.fetch<OrderBoard>("/admin/order-board", {
        query: {
          stage,
          offset: page * ORDER_PAGE_SIZE,
          ...(q ? { q } : {}),
          ...(customerId ? { customer_id: customerId } : {}),
          ...(payment ? { payment } : {}),
          ...(shipping ? { shipping } : {}),
        },
      }),
    placeholderData: keepPreviousData,
  })
