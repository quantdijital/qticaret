import type { ShopEvent } from "@qticaret/ui/lib/shop-events"
import { ga4EventWithoutAmounts, metaEventWithoutAmounts } from "./amounts"
import type { CartSnapshot } from "./cart-changes"
import { cartChanges } from "./cart-changes"
import type { AnalyticsEvent, PageContext } from "./events"
import { carriesSecret, ga4Event, metaEvent, safeLocation } from "./events"
import type { TrackingIds } from "./ids"
import { loaded, startGa4, startMeta, stopGa4, stopMeta } from "./loaders"
import { firstTime, forgetStored, storeCart, storedCart } from "./stored"

/**
 * The browser's side of the conversion events (docs/20, D9): the tags the
 * server allowed for this visitor (their cookie answer, the shop's ids)
 * are loaded with the response's nonce (`loaders.ts`), and `track()`
 * sends each event to them. Nothing is loaded and nothing leaves before
 * that; without an allowed tag `track()` does nothing.
 */

/** The tags for this visitor, and whether ad signals (Consent Mode's `ad_*`) may go with GA4. */
export interface AllowedTags extends TrackingIds {
  adSignals: boolean
  /**
   * Whether events carry prices and values: not in a signed-in wholesaler's
   * session, whose prices are theirs alone (ADR-0068 §7, `amounts.ts`).
   */
  amounts: boolean
}

const MAX_PENDING = 30

/**
 * An event, the key that makes it once per browser (a purchase), if any,
 * and false when its page said it carries no amount whoever the visitor is
 * (a wholesale order's purchase, ADR-0068 slice 5 review L2).
 */
interface Waiting {
  event: AnalyticsEvent
  once: string | null
  amounts: boolean
}

// null until the frame says what this visitor allows: events wait for it
let allowed: AllowedTags | null = null
let pending: Waiting[] = []
let context: PageContext | null = null
// The cart as this page last saw it; undefined until the frame first shows it here
let seenCart: CartSnapshot | undefined

const measuring = (): boolean => (allowed?.ga4 ?? allowed?.meta ?? null) !== null

function send(event: AnalyticsEvent, own: boolean): void {
  // Anything but a plain yes, the visitor's and the event's own, leaves the amounts out
  const amounts = own && allowed?.amounts === true
  if (allowed?.ga4 && window.gtag) {
    const [name, params] = amounts ? ga4Event(event) : ga4EventWithoutAmounts(event)
    // The address GA4 records is ours, its keys taken out (an order's link, a preview's)
    window.gtag("set", {
      page_location: safeLocation(window.location.href),
      page_referrer: safeLocation(document.referrer),
    })
    window.gtag("event", name, { ...params, send_to: allowed.ga4 })
  }
  // Meta's pixel reads the address and the referrer itself: on an address of ours holding a key it
  // hears nothing (the order's purchase still reaches it, server to server, adr/0038 §4)
  const call =
    allowed?.meta && window.fbq
      ? amounts
        ? metaEvent(event)
        : metaEventWithoutAmounts(event)
      : null
  const here = URL.parse(window.location.href)?.origin
  const ownReferrer = URL.parse(document.referrer)?.origin === here ? document.referrer : ""
  if (call && !carriesSecret(window.location.href) && !carriesSecret(ownReferrer)) {
    if (call.eventID) {
      window.fbq?.("track", call.name, call.data, { eventID: call.eventID })
    } else {
      window.fbq?.("track", call.name, call.data)
    }
  }
}

/**
 * What this visitor allows, from the frame; called again when the answer
 * changes (the banner saved). Newly allowed tags load; withdrawn ones are
 * told so, stop and lose their cookies (and, with none left, what was
 * kept for them). Events that waited are sent or dropped.
 */
export function configureAnalytics(tags: AllowedTags, nonce: string | undefined): void {
  const wasMeasuring = (loaded.ga4 ?? loaded.meta) !== null && measuring()
  if (tags.ga4) {
    startGa4(tags.ga4, tags.adSignals, nonce)
  } else if (loaded.ga4) {
    stopGa4(loaded.ga4)
  }
  if (tags.meta) {
    startMeta(tags.meta, nonce)
  } else if (loaded.meta) {
    stopMeta()
  }
  allowed = tags
  if (wasMeasuring && !measuring()) {
    forgetStored()
    seenCart = undefined
  }
  const waiting = pending
  pending = []
  waiting.forEach(deliver)
}

function deliver({ event, once, amounts }: Waiting): void {
  if (!measuring()) {
    return
  }
  // Marked only as it goes out: a visitor who allowed nothing gets nothing written either
  if (once && !firstTime(once)) {
    return
  }
  send(event, amounts)
}

/**
 * Sends an event to the tags this visitor allows; before the frame says
 * which, it waits. With `once`, only the first time in this browser. With
 * `amounts` false, without amounts whoever the visitor is.
 */
export function track(event: AnalyticsEvent, once: string | null = null, amounts = true): void {
  if (typeof window === "undefined") {
    return
  }
  if (allowed === null) {
    if (pending.length < MAX_PENDING) {
      pending.push({ event, once, amounts })
    }
    return
  }
  deliver({ event, once, amounts })
}

/**
 * A page's word that this visitor's events carry no amounts (ADR-0068
 * slice 5 review L1). The frame said it when it was last drawn, and a soft
 * navigation does not draw it again: each page with events of its own
 * says it too, asked on that page's request (`TrackEvents`). A customer
 * made a wholesaler since sends their next events, the page's and those
 * after it, without amounts. A page only ever takes amounts away: one the
 * router shows again may be older than the frame (drawn before the cookie
 * answer, say), so only the frame, drawn fresh by the server
 * (`configureAnalytics`), or a reload gives them back. Before the frame
 * has spoken it is the frame's own request: nothing to do.
 */
export function noteAmounts(amounts: boolean): void {
  if (allowed !== null && !amounts && allowed.amounts) {
    allowed = { ...allowed, amounts: false }
  }
}

/** What the page shows, for later events: a card chosen, a line added, the payment chosen. */
export function setPageContext(next: PageContext | null): void {
  context = next
}

/** The page's brand and category for a line it shows (the cart itself knows neither). */
function withPageFacts(event: AnalyticsEvent): AnalyticsEvent {
  const known = context?.items
  if (!known || !("items" in event)) {
    return event
  }
  return {
    ...event,
    items: event.items.map((item) => ({
      ...item,
      brand: item.brand ?? known[item.id]?.brand ?? null,
      category: item.category ?? known[item.id]?.category ?? null,
    })),
  }
}

/**
 * The cart as the frame shows it now (D9), against its last look: what
 * was added or taken out since goes as `add_to_cart` / `remove_from_cart`,
 * whichever form changed it. The last look is this browser's (another
 * tab's look at the same cart counts, so nothing is told twice); a first
 * look in this page at another cart only becomes the baseline.
 */
export function watchCart(next: CartSnapshot): void {
  if (typeof window === "undefined" || !measuring()) {
    return
  }
  const stored = storedCart()
  const before = stored && stored.id !== null && stored.id === next.id ? stored : seenCart
  seenCart = next
  storeCart(next)
  for (const event of cartChanges(before, next)) {
    track(withPageFacts(event))
  }
}

/** A click on a card of the page's list, as `select_item`; nothing for any other click. */
export function selectionOf(
  target: EventTarget | null,
  page: PageContext | null = context
): AnalyticsEvent | null {
  const list = page?.list
  // The click's own element (the document itself has no `closest`)
  const closest = (target as Partial<Element> | null)?.closest
  const anchor = closest ? (closest.call(target, "a[href]") as HTMLAnchorElement | null) : null
  if (!list || !anchor) {
    return null
  }
  const url = URL.parse(anchor.href, window.location.href)
  const item = url?.origin === window.location.origin ? list.links[url.pathname] : undefined
  return item ? { name: "select_item", listId: list.id, listName: list.name, items: [item] } : null
}

/**
 * A theme's signal as an event, with what the page knows; nothing when it
 * knows nothing. "Added to cart" is the cart's own look's (`watchCart`),
 * which hears every way a line goes in: the theme's signal is not counted again.
 */
export function eventOf(
  signal: ShopEvent,
  page: PageContext | null = context
): AnalyticsEvent | null {
  if (signal.type === "popup") {
    // A pop-up's own (adr/0080 §7): what it is, never what the visitor typed into it
    return { name: `popup_${signal.action}`, popupId: signal.popupId, popupType: signal.popupType }
  }
  if (signal.type !== "add_payment_info") {
    return null
  }
  const checkout = page?.checkout
  return checkout
    ? {
        name: "add_payment_info",
        value: checkout.value,
        paymentType: signal.payment,
        items: checkout.items,
      }
    : null
}
