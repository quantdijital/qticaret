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
  /** Lines made to the buyer's wish (adr/0052): how many, and whether one is outside withdrawal. */
  addons: { lines: number; non_withdrawable: boolean }
  /** Units a paid order was placed without (adr/0026 Ek 2026-11-06), while it is still to send. */
  stock_short?: number
  /** The wholesaler who placed it (ADR-0068 Ek 2026-11-15 (2)); its id for owner and admin only. */
  wholesaler?: { id?: string; name: string | null } | null
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
  /** On the retail list: wholesale orders the search found, left out (they are under Toptancılar). */
  wholesale_matches?: number
}

/** Where the money stands, apart from the stage (F12.3). */
export const PAYMENT_FILTERS = ["paid", "awaiting", "refunded"] as const
export type PaymentFilter = (typeof PAYMENT_FILTERS)[number]

/** Where the parcel stands, apart from the stage (F12.3). */
export const SHIPPING_FILTERS = ["none", "label", "on_the_way", "delivered", "problem"] as const
export type ShippingFilter = (typeof SHIPPING_FILTERS)[number]

/** How it was paid: card, bank transfer, at the door, or through a payment link (adr/0051). */
export const PAYMENT_METHODS = ["card", "bank_transfer", "cod", "payment_link"] as const
export type PaymentMethod = (typeof PAYMENT_METHODS)[number]

/** Who carries it, by the delivery chosen: a carrier, or the shop's own delivery and collection. */
export const CARRIER_FILTERS = ["aras", "yurtici", "geliver", "own"] as const
export type CarrierFilter = (typeof CARRIER_FILTERS)[number]

/** Whose orders a list shows (ADR-0068 Ek 2026-11-15 (2)): retail is the server's default. */
export const ORDER_SEGMENTS = ["retail", "wholesale", "all"] as const
export type OrderSegment = (typeof ORDER_SEGMENTS)[number]

/** The list's filters as the server takes them, the export's too; days are Turkish `YYYY-MM-DD`. */
export interface OrderFilters {
  stage: OrderStage
  q: string
  /** One customer's orders, for their page. */
  customerId?: string | undefined
  payment?: PaymentFilter | undefined
  shipping?: ShippingFilter | undefined
  method?: PaymentMethod | undefined
  carrier?: CarrierFilter | undefined
  from?: string | undefined
  to?: string | undefined
  /** Retail orders unless set; the wholesale list and a customer's page set it. */
  segment?: OrderSegment | undefined
  /** One wholesaler's orders, on the wholesale list. */
  wholesaler?: string | undefined
}

/** The filters as the server names them, empty ones left out. */
export const filterQuery = (filters: OrderFilters): Record<string, string> => ({
  stage: filters.stage,
  ...(filters.q ? { q: filters.q } : {}),
  ...(filters.customerId ? { customer_id: filters.customerId } : {}),
  ...(filters.payment ? { payment: filters.payment } : {}),
  ...(filters.shipping ? { shipping: filters.shipping } : {}),
  ...(filters.method ? { method: filters.method } : {}),
  ...(filters.carrier ? { carrier: filters.carrier } : {}),
  ...(filters.from ? { from: filters.from } : {}),
  ...(filters.to ? { to: filters.to } : {}),
  ...(filters.segment ? { segment: filters.segment } : {}),
  ...(filters.wholesaler ? { wholesaler: filters.wholesaler } : {}),
})

export interface OrderBoardParams extends OrderFilters {
  page: number
}

export const ORDER_PAGE_SIZE = 20

export const orderBoardQuery = ({ page, ...filters }: OrderBoardParams) =>
  queryOptions({
    queryKey: ["orders", "board", { page, ...filters }],
    queryFn: () =>
      sdk.client.fetch<OrderBoard>("/admin/order-board", {
        query: { ...filterQuery(filters), offset: page * ORDER_PAGE_SIZE },
      }),
    placeholderData: keepPreviousData,
  })
