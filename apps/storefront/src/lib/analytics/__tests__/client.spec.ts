import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as Client from "../client"
import type { AnalyticsEvent } from "../events"

/** Just enough of a browser for the loaders: scripts appended, cookies written, a tab's storage. */
function fakeBrowser(href = "https://shop.test/urun/gomlek") {
  const scripts: { src: string; nonce: string; async: boolean }[] = []
  const written: string[] = []
  const storage = new Map<string, string>()
  const win: Record<string, unknown> = {
    location: { href, hostname: "shop.test" },
    sessionStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  }
  const doc = {
    referrer: "",
    head: { appendChild: (script: (typeof scripts)[number]) => scripts.push(script) },
    createElement: () => ({ src: "", nonce: "", async: false }),
    get cookie() {
      return "_ga=GA1.1.1.2; _ga_ABC=x; other=1; _fbp=fb.1.1700000000000.1"
    },
    set cookie(value: string) {
      written.push(value)
    },
  }
  vi.stubGlobal("window", win)
  vi.stubGlobal("document", doc)
  return { scripts, written, win, doc }
}

/** The calls pushed to GA4's data layer, as plain arrays. */
const layer = (win: Record<string, unknown>) =>
  ((win["dataLayer"] as ArrayLike<unknown>[] | undefined) ?? []).map((call) => Array.from(call))

/** The calls Meta's pixel queued. */
const metaCalls = (win: Record<string, unknown>) =>
  ((win["fbq"] as { queue: unknown[][] } | undefined)?.queue ?? []).map((call) => Array.from(call))

const view: AnalyticsEvent = {
  name: "view_item",
  value: 10,
  items: [{ id: "variant_1", name: "A", price: 10, quantity: 1 }],
}

const purchase: AnalyticsEvent = {
  name: "purchase",
  transactionId: "order_1",
  value: 100,
  shipping: 0,
  items: [{ id: "variant_1", name: "A", price: 100, quantity: 1 }],
}

let client: typeof Client

beforeEach(async () => {
  vi.resetModules()
  client = await import("../client")
})

afterEach(() => {
  vi.unstubAllGlobals()
})

describe("the tags in the browser", () => {
  it("loads nothing and sends nothing without an allowed tag", () => {
    const { scripts, win } = fakeBrowser()
    client.track(view)
    client.configureAnalytics({ ga4: null, meta: null, adSignals: false }, "n0nce")
    client.track(view)
    expect(scripts).toEqual([])
    expect(win["gtag"]).toBeUndefined()
    expect(win["fbq"]).toBeUndefined()
    expect(win["dataLayer"]).toBeUndefined()
  })

  it("loads GA4 with the nonce, everything denied before it reads, then the answer, then the waiting events", () => {
    const { scripts, win } = fakeBrowser()
    client.track(view)
    expect(scripts).toEqual([])
    client.configureAnalytics({ ga4: "G-ABC123", meta: null, adSignals: false }, "n0nce")
    expect(scripts).toEqual([
      { src: "https://www.googletagmanager.com/gtag/js?id=G-ABC123", nonce: "n0nce", async: true },
    ])
    const calls = layer(win)
    expect(calls[0]).toEqual([
      "consent",
      "default",
      {
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
        analytics_storage: "denied",
      },
    ])
    expect(calls[1]).toEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ])
    expect(calls).toContainEqual(["config", "G-ABC123", { send_page_view: false }])
    const event = calls.find((call) => call[0] === "event")
    expect(event?.[1]).toBe("view_item")
    expect(event?.[2]).toMatchObject({ send_to: "G-ABC123", currency: "TRY", value: 10 })
    // Loaded once, whatever re-renders the frame
    client.configureAnalytics({ ga4: "G-ABC123", meta: null, adSignals: true }, "n0nce")
    expect(scripts).toHaveLength(1)
    expect(layer(win).at(-1)).toEqual([
      "consent",
      "update",
      {
        analytics_storage: "granted",
        ad_storage: "granted",
        ad_user_data: "granted",
        ad_personalization: "granted",
      },
    ])
  })

  it("tells GA4 the address without its keys", () => {
    const { win } = fakeBrowser("https://shop.test/siparis/order_1?token=abc.def&yeni=1")
    client.configureAnalytics({ ga4: "G-ABC123", meta: null, adSignals: false }, undefined)
    client.track(purchase)
    const set = layer(win).find((call) => call[0] === "set")
    expect(set?.[1]).toEqual({
      page_location: "https://shop.test/siparis/order_1?yeni=1",
      page_referrer: "",
    })
    expect(JSON.stringify(layer(win))).not.toContain("abc.def")
    expect(layer(win).find((call) => call[1] === "purchase")?.[2]).toMatchObject({
      transaction_id: "order_1",
    })
  })

  it("loads Meta's pixel with the nonce; a purchase carries the order's id as its event id", () => {
    const { scripts, win } = fakeBrowser("https://shop.test/siparis/order_1?yeni=1")
    client.configureAnalytics({ ga4: null, meta: "1234567890", adSignals: true }, "n0nce")
    expect(scripts).toEqual([
      { src: "https://connect.facebook.net/en_US/fbevents.js", nonce: "n0nce", async: true },
    ])
    expect((win["fbq"] as { disablePushState?: boolean }).disablePushState).toBe(true)
    client.track(purchase)
    const calls = metaCalls(win)
    expect(calls.slice(0, 3)).toEqual([
      ["consent", "grant"],
      ["set", "autoConfig", false, "1234567890"],
      ["init", "1234567890"],
    ])
    expect(calls.at(-1)?.[1]).toBe("Purchase")
    expect(calls.at(-1)?.[3]).toEqual({ eventID: "order_1" })
  })

  it("keeps Meta's pixel silent on an address of ours holding a key, or coming from one", () => {
    const { win, doc } = fakeBrowser("https://shop.test/siparis/order_1?token=abc.def&yeni=1")
    client.configureAnalytics({ ga4: null, meta: "1234567890", adSignals: true }, undefined)
    client.track(purchase)
    expect(metaCalls(win).some((call) => call[0] === "track")).toBe(false)

    const location = win["location"] as { href: string }
    location.href = "https://shop.test/"
    doc.referrer = "https://shop.test/siparis/order_1?token=abc.def"
    client.track(view)
    expect(metaCalls(win).some((call) => call[0] === "track")).toBe(false)
    // Another site's address is not ours to judge: its `t=` is no key of ours
    doc.referrer = "https://video.example/watch?t=42"
    client.track(view)
    expect(metaCalls(win).filter((call) => call[0] === "track")).toHaveLength(1)
  })

  it("stops a withdrawn tag and forgets its cookies", () => {
    const { win, written } = fakeBrowser()
    client.configureAnalytics({ ga4: "G-ABC123", meta: "1234567890", adSignals: true }, undefined)
    client.configureAnalytics({ ga4: null, meta: null, adSignals: false }, undefined)
    expect(layer(win).at(-1)).toEqual([
      "consent",
      "update",
      {
        analytics_storage: "denied",
        ad_storage: "denied",
        ad_user_data: "denied",
        ad_personalization: "denied",
      },
    ])
    expect(win["ga-disable-G-ABC123"]).toBe(true)
    expect(metaCalls(win).at(-1)).toEqual(["consent", "revoke"])
    expect(written).toContain("_ga=; max-age=0; path=/")
    expect(written).toContain("_ga_ABC=; max-age=0; path=/; domain=.shop.test")
    expect(written).toContain("_fbp=; max-age=0; path=/")
    expect(written.some((each) => each.startsWith("other="))).toBe(false)
    // Nothing more goes out
    const before = layer(win).length
    client.track(view)
    expect(layer(win)).toHaveLength(before)
  })

  it("counts a key once per tab", () => {
    fakeBrowser()
    expect(client.firstInSession("purchase:order_1")).toBe(true)
    expect(client.firstInSession("purchase:order_1")).toBe(false)
    expect(client.firstInSession("purchase:order_2")).toBe(true)
  })

  it("sends a once-only event once, and writes nothing for a visitor who allowed nothing", () => {
    const { win } = fakeBrowser()
    const storage = win["sessionStorage"] as { getItem: (key: string) => string | null }
    client.track(purchase, "purchase:order_1")
    client.configureAnalytics({ ga4: null, meta: null, adSignals: false }, undefined)
    expect(storage.getItem("qt_event:purchase:order_1")).toBeNull()

    vi.resetModules()
    return import("../client").then((fresh) => {
      fresh.configureAnalytics({ ga4: "G-ABC123", meta: null, adSignals: false }, undefined)
      fresh.track(purchase, "purchase:order_1")
      fresh.track(purchase, "purchase:order_1")
      const sent = layer(win).filter((call) => call[1] === "purchase")
      expect(sent).toHaveLength(1)
      expect(storage.getItem("qt_event:purchase:order_1")).toBe("1")
    })
  })

  it("turns the theme's signals into events with what the page knows", () => {
    fakeBrowser()
    const item = { id: "variant_1", name: "A", price: 25, quantity: 1 }
    expect(client.eventOf({ type: "add_to_cart", variantId: "variant_1", quantity: 2 })).toBeNull()
    client.setPageContext({ items: { variant_1: item } })
    expect(client.eventOf({ type: "add_to_cart", variantId: "variant_1", quantity: 2 })).toEqual({
      name: "add_to_cart",
      value: 50,
      items: [{ ...item, quantity: 2 }],
    })
    expect(client.eventOf({ type: "add_to_cart", variantId: "variant_x", quantity: 1 })).toBeNull()
    expect(
      client.eventOf(
        { type: "add_payment_info", payment: "card" },
        { checkout: { value: 50, items: [item] } }
      )
    ).toEqual({ name: "add_payment_info", value: 50, paymentType: "card", items: [item] })
  })
})
