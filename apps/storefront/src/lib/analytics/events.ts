/**
 * The storefront's conversion events (docs/20 "vitrin dönüşüm olayları",
 * D9) and how GA4's gtag and Meta's pixel read each one. Pure: the
 * pages build events on the server, the browser sends them only within
 * the cookie answer (`client.ts`). Amounts are lira, KDV in.
 */

export const CURRENCY = "TRY"

/** One product line as both tags read it; the id is the variant's (the feeds' and the server events' id). */
export interface AnalyticsItem {
  /** The variant's id; a list of products, which names no variant, gives the product's. */
  id: string
  name: string
  price: number | null
  quantity: number
  brand?: string | null
  category?: string | null
  /** The variant's own name ("M / Mavi"). */
  variant?: string | null
}

export type AnalyticsEvent =
  | { name: "page_view"; location: string; referrer: string; title: string }
  | { name: "view_item"; value: number; items: AnalyticsItem[] }
  | { name: "view_item_list"; listId: string; listName: string; items: AnalyticsItem[] }
  | { name: "search"; term: string }
  | { name: "add_to_cart"; value: number; items: AnalyticsItem[] }
  | { name: "begin_checkout"; value: number; items: AnalyticsItem[] }
  | { name: "add_payment_info"; value: number; paymentType: string; items: AnalyticsItem[] }
  | {
      name: "purchase"
      /** The order's id: GA4's `transaction_id`, Meta's `eventID`; the backend's server events use the same. */
      transactionId: string
      value: number
      shipping: number
      items: AnalyticsItem[]
    }
  | { name: "sign_up"; method: "email" }

/** What a page knows for the theme's later "added to cart" and "payment chosen". */
export interface PageContext {
  /** The page's variants by id (the product page). */
  items?: Record<string, AnalyticsItem>
  /** The cart being paid (the checkout). */
  checkout?: { value: number; items: AnalyticsItem[] }
}

const money = (value: number): number => Math.round(value * 100) / 100

/** A line's worth: its price times its quantity. */
export const itemsValue = (items: readonly AnalyticsItem[]): number =>
  money(items.reduce((sum, item) => sum + (item.price ?? 0) * item.quantity, 0))

function ga4Item(item: AnalyticsItem, index: number) {
  return {
    item_id: item.id,
    item_name: item.name,
    index,
    quantity: item.quantity,
    ...(item.price !== null ? { price: money(item.price) } : {}),
    ...(item.brand ? { item_brand: item.brand } : {}),
    ...(item.category ? { item_category: item.category } : {}),
    ...(item.variant ? { item_variant: item.variant } : {}),
  }
}

/** The event as `gtag("event", name, params)` sends it (GA4's recommended ecommerce events). */
export function ga4Event(event: AnalyticsEvent): [string, Record<string, unknown>] {
  switch (event.name) {
    case "page_view":
      return [
        "page_view",
        { page_location: event.location, page_referrer: event.referrer, page_title: event.title },
      ]
    case "search":
      return ["search", { search_term: event.term }]
    case "sign_up":
      return ["sign_up", { method: event.method }]
    case "view_item_list":
      return [
        "view_item_list",
        {
          item_list_id: event.listId,
          item_list_name: event.listName,
          items: event.items.map(ga4Item),
        },
      ]
    case "purchase":
      return [
        "purchase",
        {
          transaction_id: event.transactionId,
          currency: CURRENCY,
          value: money(event.value),
          shipping: money(event.shipping),
          items: event.items.map(ga4Item),
        },
      ]
    case "add_payment_info":
      return [
        "add_payment_info",
        {
          currency: CURRENCY,
          value: money(event.value),
          payment_type: event.paymentType,
          items: event.items.map(ga4Item),
        },
      ]
    case "view_item":
    case "add_to_cart":
    case "begin_checkout":
      return [
        event.name,
        { currency: CURRENCY, value: money(event.value), items: event.items.map(ga4Item) },
      ]
  }
}

/** Meta's call: a standard event, its data and, for a purchase, the id the server event shares. */
export interface MetaCall {
  name: string
  data: Record<string, unknown>
  eventID?: string
}

const contents = (items: readonly AnalyticsItem[]) => ({
  content_type: "product",
  content_ids: items.map((item) => item.id),
  contents: items.map((item) => ({
    id: item.id,
    quantity: item.quantity,
    ...(item.price !== null ? { item_price: money(item.price) } : {}),
  })),
})

/** The event as `fbq("track", name, data, { eventID })` sends it; null: Meta has no such standard event. */
export function metaEvent(event: AnalyticsEvent): MetaCall | null {
  switch (event.name) {
    case "page_view":
      return { name: "PageView", data: {} }
    case "view_item":
      return {
        name: "ViewContent",
        data: { ...contents(event.items), currency: CURRENCY, value: money(event.value) },
      }
    case "search":
      return { name: "Search", data: { search_string: event.term } }
    case "add_to_cart":
      return {
        name: "AddToCart",
        data: { ...contents(event.items), currency: CURRENCY, value: money(event.value) },
      }
    case "begin_checkout":
      return {
        name: "InitiateCheckout",
        data: {
          ...contents(event.items),
          currency: CURRENCY,
          value: money(event.value),
          num_items: event.items.reduce((sum, item) => sum + item.quantity, 0),
        },
      }
    case "add_payment_info":
      return {
        name: "AddPaymentInfo",
        data: { ...contents(event.items), currency: CURRENCY, value: money(event.value) },
      }
    case "purchase":
      return {
        name: "Purchase",
        data: {
          ...contents(event.items),
          currency: CURRENCY,
          value: money(event.value),
          num_items: event.items.reduce((sum, item) => sum + item.quantity, 0),
        },
        // The backend's Conversions API event carries the same id: Meta counts the order once
        eventID: event.transactionId,
      }
    case "sign_up":
      return { name: "CompleteRegistration", data: {} }
    case "view_item_list":
      return null
  }
}

/**
 * Query words that are a key to something (an order's, a link's, a code)
 * and paths that hold one: never told to a tag.
 */
const SECRET_PARAMS = new Set(["token", "t", "code", "davet"])
const SECRET_PATHS: [RegExp, string][] = [
  [/^\/onizleme\/.+$/, "/onizleme"],
  // A payment link (adr/0051): its token is the key to someone's order
  [/^\/ode\/.+$/, "/ode"],
]

/** The address as a tag may hear it: its keys and tokens taken out, everything else as it is. */
export function safeLocation(href: string): string {
  const url = URL.parse(href)
  if (!url) {
    return ""
  }
  for (const key of [...url.searchParams.keys()]) {
    if (SECRET_PARAMS.has(key)) {
      url.searchParams.delete(key)
    }
  }
  for (const [pattern, replacement] of SECRET_PATHS) {
    if (pattern.test(url.pathname)) {
      url.pathname = replacement
    }
  }
  url.hash = ""
  return url.href
}

/** Whether the address holds a key: Meta's pixel reads the address itself, so it hears nothing there. */
export function carriesSecret(href: string): boolean {
  const url = URL.parse(href)
  if (!url) {
    return false
  }
  return (
    [...url.searchParams.keys()].some((key) => SECRET_PARAMS.has(key)) ||
    SECRET_PATHS.some(([pattern]) => pattern.test(url.pathname))
  )
}
