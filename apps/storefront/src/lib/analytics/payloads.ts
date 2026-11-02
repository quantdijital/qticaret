import type { StoreProduct } from "@qticaret/types"
import type { AnalyticsEvent, AnalyticsItem, PageContext } from "./events"
import { itemsValue } from "./events"

/**
 * The pages' events from what the Store API answered (docs/20, D9). The
 * price is the one the page shows (`calculated_amount`, KDV in); an item's
 * id is its variant's, as in the feeds and the backend's server events.
 */

const priceOf = (amount: unknown): number | null =>
  typeof amount === "number" && Number.isFinite(amount) ? amount : null

/** Every variant of the product as an item, by variant id: the product page's context. */
export function productItems(product: StoreProduct): Record<string, AnalyticsItem> {
  return Object.fromEntries(
    (product.variants ?? []).map((variant) => [
      variant.id,
      {
        id: variant.id,
        name: product.title,
        price: priceOf(variant.calculated_price?.calculated_amount),
        quantity: 1,
        brand: product.brand?.name ?? null,
        variant: variant.title ?? null,
      },
    ])
  )
}

/** The product page: `view_item` of the variant shown, and its variants for "added to cart". */
export function productEvents(
  product: StoreProduct,
  selectedVariantId: string | null
): { events: AnalyticsEvent[]; context: PageContext } {
  const items = productItems(product)
  const shown =
    (selectedVariantId ? items[selectedVariantId] : undefined) ?? Object.values(items)[0]
  return {
    events: shown ? [{ name: "view_item", value: itemsValue([shown]), items: [shown] }] : [],
    context: { items },
  }
}

/** A list of products (a category, brand, search…): each product once, at its lowest price. */
export function listEvent(
  listId: string,
  listName: string,
  products: readonly StoreProduct[]
): Extract<AnalyticsEvent, { name: "view_item_list" }> {
  return {
    name: "view_item_list",
    listId,
    listName,
    items: products.map((product) => {
      const prices = (product.variants ?? []).flatMap((variant) => {
        const price = priceOf(variant.calculated_price?.calculated_amount)
        return price === null ? [] : [price]
      })
      return {
        id: product.id,
        name: product.title,
        price: prices.length > 0 ? Math.min(...prices) : null,
        quantity: 1,
        brand: product.brand?.name ?? null,
        ...(listId.startsWith("product_category") ? { category: listName } : {}),
      }
    }),
  }
}

/** A cart or order line as the events need it. */
export interface LineFacts {
  variant_id?: string | null
  product_id?: string | null
  product_title?: string | null
  title: string
  variant_title?: string | null
  unit_price?: number | null
  quantity: number
}

export const lineItems = (lines: readonly LineFacts[]): AnalyticsItem[] =>
  lines.map((line) => ({
    id: line.variant_id ?? line.product_id ?? line.title,
    name: line.product_title ?? line.title,
    price: priceOf(line.unit_price),
    quantity: line.quantity,
    variant: line.variant_title ?? null,
  }))

/** The checkout's `begin_checkout`, and its cart for the payment step's signal. */
export function checkoutEvents(cart: { item_total: number; items: readonly LineFacts[] }): {
  events: AnalyticsEvent[]
  context: PageContext
} {
  const items = lineItems(cart.items)
  const value = Math.round(cart.item_total * 100) / 100
  return {
    events: [{ name: "begin_checkout", value, items }],
    context: { checkout: { value, items } },
  }
}

/**
 * The order's `purchase`, as the backend's server events read it (adr/0038
 * §4): its id the transaction and event id, its total and shipping.
 */
export function purchaseEvent(order: {
  id: string
  total: number
  shipping_total: number
  items: readonly LineFacts[]
}): AnalyticsEvent {
  return {
    name: "purchase",
    transactionId: order.id,
    value: order.total,
    shipping: order.shipping_total,
    items: lineItems(order.items),
  }
}
