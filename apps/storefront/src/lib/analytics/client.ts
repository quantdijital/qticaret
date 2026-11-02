import type { ShopEvent } from "@qticaret/ui/lib/shop-events"
import type { AnalyticsEvent, PageContext } from "./events"
import { carriesSecret, ga4Event, itemsValue, metaEvent, safeLocation } from "./events"
import type { TrackingIds } from "./ids"

/**
 * The browser's side of the conversion events (docs/20, D9): the tags the
 * server allowed for this visitor (their cookie answer, the shop's ids)
 * are loaded with the response's nonce, and `track()` sends each event
 * to them. Nothing is loaded and nothing leaves before that; without an
 * allowed tag `track()` does nothing. No library: GA4's and Meta's own
 * loaders, written out.
 */

type Command = (...args: unknown[]) => void

interface MetaQueue extends Command {
  callMethod?: Command
  queue: unknown[]
  push: MetaQueue
  loaded: boolean
  version: string
  disablePushState?: boolean
}

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: Command
    fbq?: MetaQueue
    _fbq?: MetaQueue
  }
}

/** The tags for this visitor, and whether ad signals (Consent Mode's `ad_*`) may go with GA4. */
export interface AllowedTags extends TrackingIds {
  adSignals: boolean
}

const GTAG = "https://www.googletagmanager.com/gtag/js"
const FBEVENTS = "https://connect.facebook.net/en_US/fbevents.js"
const MAX_PENDING = 30

/** An event, and the key that makes it once per tab (a purchase), if any. */
interface Waiting {
  event: AnalyticsEvent
  once: string | null
}

// null until the frame says what this visitor allows: events wait for it
let allowed: AllowedTags | null = null
let pending: Waiting[] = []
let context: PageContext | null = null
const loaded: { ga4: string | null; meta: string | null } = { ga4: null, meta: null }

function inject(src: string, nonce: string | undefined): void {
  const script = document.createElement("script")
  script.async = true
  script.src = src
  if (nonce) {
    script.nonce = nonce
  }
  document.head.appendChild(script)
}

const grant = (yes: boolean) => (yes ? "granted" : "denied")

function startGa4(id: string, adSignals: boolean, nonce: string | undefined): void {
  window.dataLayer = window.dataLayer ?? []
  if (!window.gtag) {
    window.gtag = function gtag() {
      // gtag.js reads the arguments object itself, not an array
      // eslint-disable-next-line prefer-rest-params
      window.dataLayer?.push(arguments)
    }
    // Consent Mode v2: everything denied before the tag reads anything
    window.gtag("consent", "default", {
      ad_storage: "denied",
      ad_user_data: "denied",
      ad_personalization: "denied",
      analytics_storage: "denied",
    })
  }
  window.gtag("consent", "update", {
    analytics_storage: "granted",
    ad_storage: grant(adSignals),
    ad_user_data: grant(adSignals),
    ad_personalization: grant(adSignals),
  })
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = false
  if (loaded.ga4 !== id) {
    window.gtag("js", new Date())
    // Page views are ours, one per route (the router changes pages without a load)
    window.gtag("config", id, { send_page_view: false })
    inject(`${GTAG}?id=${encodeURIComponent(id)}`, nonce)
    loaded.ga4 = id
  }
}

function startMeta(id: string, nonce: string | undefined): void {
  if (!window.fbq) {
    const fbq = function (...args: unknown[]) {
      if (fbq.callMethod) {
        fbq.callMethod(...args)
      } else {
        fbq.queue.push(args)
      }
    } as MetaQueue
    fbq.push = fbq
    fbq.loaded = true
    fbq.version = "2.0"
    fbq.queue = []
    // Page views are ours, one per route: the pixel must not count history changes itself
    fbq.disablePushState = true
    window.fbq = fbq
    window._fbq = window._fbq ?? fbq
    inject(FBEVENTS, nonce)
  }
  window.fbq("consent", "grant")
  if (loaded.meta !== id) {
    // Only the events we send: no button scraping
    window.fbq("set", "autoConfig", false, id)
    window.fbq("init", id)
    loaded.meta = id
  }
}

/** A tag's own cookies, gone once its consent is withdrawn (on this host and the shop's domain). */
function forgetCookies(names: RegExp): void {
  const parts = window.location.hostname.split(".")
  const domains = [
    "",
    ...parts.slice(0, -1).map((_, index) => `; domain=.${parts.slice(index).join(".")}`),
  ]
  for (const pair of document.cookie.split(";")) {
    const name = pair.split("=")[0]?.trim() ?? ""
    if (names.test(name)) {
      for (const domain of domains) {
        document.cookie = `${name}=; max-age=0; path=/${domain}`
      }
    }
  }
}

function stopGa4(id: string): void {
  window.gtag?.("consent", "update", {
    analytics_storage: "denied",
    ad_storage: "denied",
    ad_user_data: "denied",
    ad_personalization: "denied",
  })
  ;(window as unknown as Record<string, unknown>)[`ga-disable-${id}`] = true
  forgetCookies(/^_ga(?:_|$)/)
}

function stopMeta(): void {
  window.fbq?.("consent", "revoke")
  forgetCookies(/^_fb[pc]$/)
}

function send(event: AnalyticsEvent): void {
  if (allowed?.ga4 && window.gtag) {
    const [name, params] = ga4Event(event)
    // The address GA4 records is ours, its keys taken out (an order's link, a preview's)
    window.gtag("set", {
      page_location: safeLocation(window.location.href),
      page_referrer: safeLocation(document.referrer),
    })
    window.gtag("event", name, { ...params, send_to: allowed.ga4 })
  }
  // Meta's pixel reads the address and the referrer itself: on an address of ours holding a key it
  // hears nothing (the order's purchase still reaches it, server to server, adr/0038 §4)
  const call = allowed?.meta && window.fbq ? metaEvent(event) : null
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
 * told so, stop and lose their cookies. Events that waited are sent or dropped.
 */
export function configureAnalytics(tags: AllowedTags, nonce: string | undefined): void {
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
  const waiting = pending
  pending = []
  waiting.forEach(deliver)
}

function deliver({ event, once }: Waiting): void {
  if (!allowed?.ga4 && !allowed?.meta) {
    return
  }
  // Marked only as it goes out: a visitor who allowed nothing gets nothing written either
  if (once && !firstInSession(once)) {
    return
  }
  send(event)
}

/**
 * Sends an event to the tags this visitor allows; before the frame says
 * which, it waits. With `once`, only the first time in this tab.
 */
export function track(event: AnalyticsEvent, once: string | null = null): void {
  if (typeof window === "undefined") {
    return
  }
  if (allowed === null) {
    if (pending.length < MAX_PENDING) {
      pending.push({ event, once })
    }
    return
  }
  deliver({ event, once })
}

/** True the first time a key is asked in this tab (a purchase is counted once, whatever reloads it). */
export function firstInSession(key: string): boolean {
  try {
    const name = `qt_event:${key}`
    if (window.sessionStorage.getItem(name)) {
      return false
    }
    window.sessionStorage.setItem(name, "1")
  } catch {
    // Storage refused: the tags' own ids (transaction, event) still count it once
  }
  return true
}

/** What the page shows, for the theme's later "added to cart" and "payment chosen". */
export function setPageContext(next: PageContext | null): void {
  context = next
}

/** A theme's signal as an event, with what the page knows; nothing when it knows nothing. */
export function eventOf(
  signal: ShopEvent,
  page: PageContext | null = context
): AnalyticsEvent | null {
  if (signal.type === "add_to_cart") {
    const item = page?.items?.[signal.variantId]
    if (!item) {
      return null
    }
    const items = [{ ...item, quantity: signal.quantity }]
    return { name: "add_to_cart", value: itemsValue(items), items }
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
