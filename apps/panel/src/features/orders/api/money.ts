import { queryOptions } from "@tanstack/react-query"
import { useOrderMutation } from "@/features/orders/api/mutation"
import { sdk } from "@/lib/sdk"

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
