import { queryOptions } from "@tanstack/react-query"
import { sdk } from "@/lib/sdk"

/** How a variant's price is shown today (F4.3, ADR-0023); amounts as exact lira ("80.00"). */
export interface PriceDisplayView {
  current: string
  regular: string
  /** Struck through in the storefront; null when it is not shown as a discount. */
  before: string | null
  /** The 30-day rule's price before the discount, shown or not. */
  lowest_before: string | null
  on_sale: boolean
  since: string | null
  basis: "history" | "regular" | null
}

export interface PricePointRow {
  at: string
  amount: string
  original: string
}

export interface VariantPriceHistory {
  id: string
  title: string | null
  sku: string | null
  display: PriceDisplayView | null
  points: PricePointRow[]
}

export interface PriceHistory {
  currency_code: string
  rule_version: string
  window_days: number
  window_start: string
  variants: VariantPriceHistory[]
}

/** `GET /admin/products/:id/price-history`: 90 days of selling prices, and the 30-day rule's reading. */
export const priceHistoryQuery = (productId: string, currency: string) =>
  queryOptions({
    queryKey: ["products", "price-history", productId, currency],
    queryFn: () =>
      sdk.client.fetch<PriceHistory>(
        `/admin/products/${encodeURIComponent(productId)}/price-history`,
        { query: { currency_code: currency } }
      ),
  })
