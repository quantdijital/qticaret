import { queryOptions } from "@tanstack/react-query"
import type { PaymentMethod } from "@/features/orders/api/board"
import { sdk } from "@/lib/sdk"

/** A line's add-on pick as the slip prints it: the add-on's name and, in full, what was picked. */
export interface PackingAddon {
  label: string
  value: string
  kind: "text" | "choice"
}

export interface PackingItem {
  id: string
  title: string
  variant: string | null
  sku: string | null
  quantity: number
  /** False for a line that goes in no box (a gift card, a digital product). */
  ships: boolean
  addons: PackingAddon[]
  non_withdrawable: boolean
  /** A gift card line's recipient and note. */
  gift: { recipient: string; message: string | null; sender: string | null } | null
  /** Lira as text; null unless the shop prints prices (Settings > Shipping). */
  unit_price: string | null
  total: string | null
}

export interface PackingOrder {
  id: string
  display_id: number
  created_at: string
  currency_code: string
  email: string | null
  shipping_address: {
    name: string | null
    company: string | null
    address_1: string | null
    address_2: string | null
    district: string | null
    city: string | null
    postal_code: string | null
    phone: string | null
  } | null
  payment_method: PaymentMethod | "gift_card" | "other"
  delivery: { name: string; carrier: string | null } | null
  tracking_number: string | null
  items: PackingItem[]
  /** The team's notes on the order: the pick list's; a slip's only when asked. */
  notes: string[]
  /** The shopper's own note at checkout, printed on every slip (Batch 8 / O1). */
  customer_note?: string | null
  totals: { items: string; shipping: string; discount: string; total: string } | null
}

export interface PackingSlips {
  shop: {
    name: string | null
    logo_url: string | null
    company_title: string | null
    address: string | null
    email: string | null
    phone: string | null
  }
  /** Whether the slips print prices (`shipping.packing_slip_prices`). */
  prices: boolean
  orders: PackingOrder[]
}

/** The most orders printed at once (the server's `MAX_PACKING_ORDERS`). */
export const MAX_PRINT_ORDERS = 50

/** `GET /admin/packing-slips?ids=`: what the picked orders' slips and pick list print (a recorded read). */
export const packingSlipsQuery = (ids: readonly string[]) =>
  queryOptions({
    queryKey: ["orders", "packing", ids],
    queryFn: () =>
      sdk.client.fetch<PackingSlips>("/admin/packing-slips", { query: { ids: ids.join(",") } }),
    // Printed once, never kept: addresses do not linger in the cache
    gcTime: 0,
    staleTime: 0,
  })
