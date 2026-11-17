import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type * as Client from "../client"
import type { AnalyticsEvent } from "../events"
import { fakeBrowser, layer, metaCalls } from "../../../test/fake-browser"

const line = { id: "variant_1", name: "Şef bıçağı", price: 612.5, quantity: 12, brand: "Marka" }
const purchase: AnalyticsEvent = {
  name: "purchase",
  transactionId: "order_1",
  value: 7350,
  shipping: 90,
  items: [line],
}
const viewed: AnalyticsEvent = { name: "view_item", value: 612.5, items: [line] }
const RETAIL = { ga4: "G-ABC123", meta: "1234567890", adSignals: true, amounts: true }

type Win = Record<string, unknown>
const ga4Sent = (win: Win) => layer(win).filter((call) => call[0] === "event")
const metaTracked = (win: Win) => metaCalls(win).filter((call) => call[0] === "track")

/** ADR-0068 slice 5 review L1 and L2: who decides whether an event carries amounts. */
describe("the server's word on amounts, page by page", () => {
  let client: typeof Client

  beforeEach(async () => {
    vi.resetModules()
    client = await import("../client")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends a wholesale order's purchase without amounts, though no session made the visitor one (L2)", () => {
    // Opened signed out: the frame says retail; the order says wholesale
    const { win } = fakeBrowser("https://shop.test/siparis/order_1?yeni=1")
    client.configureAnalytics(RETAIL, undefined)
    client.track(purchase, "purchase:order_1", false)

    expect(ga4Sent(win).map((call) => call[1])).toEqual(["purchase"])
    expect(JSON.stringify(ga4Sent(win))).not.toMatch(/612|7350|"value"|"price"|"currency"/)
    // Meta's purchase needs its value: none at all
    expect(metaTracked(win)).toEqual([])
  })

  it("keeps a retail order's purchase whole", () => {
    const { win } = fakeBrowser("https://shop.test/siparis/order_1?yeni=1")
    client.configureAnalytics(RETAIL, undefined)
    client.track(purchase, "purchase:order_1")

    expect(ga4Sent(win)[0]?.[2]).toMatchObject({ value: 7350, currency: "TRY" })
    expect(metaTracked(win).map((call) => call[1])).toEqual(["Purchase"])
  })

  it("sends the next event without amounts once a page says the customer became a wholesaler (L1)", () => {
    const { win } = fakeBrowser()
    // The frame drawn while the customer was retail; a soft navigation does not draw it again
    client.configureAnalytics(RETAIL, undefined)
    client.track(viewed)
    client.noteAmounts(false)
    client.track(viewed)

    const values = ga4Sent(win).map((call) => (call[2] as { value?: number }).value)
    expect(values).toEqual([612.5, undefined])
    const meta = metaTracked(win).map((call) => (call[2] as { value?: number }).value)
    expect(meta).toEqual([612.5, undefined])
  })

  it("keeps the amounts off when a page the router shows again says yes; the frame alone gives them back", () => {
    const { win } = fakeBrowser()
    client.configureAnalytics(RETAIL, undefined)
    client.noteAmounts(false)
    // Back to a page drawn earlier (before the cookie answer, say): its word is older
    client.noteAmounts(true)
    client.track(viewed)
    // The frame drawn fresh by the server: the customer is retail again
    client.configureAnalytics(RETAIL, undefined)
    client.track(viewed)

    const values = ga4Sent(win).map((call) => (call[2] as { value?: number }).value)
    expect(values).toEqual([undefined, 612.5])
  })

  it("does not let an event's own yes put back the amounts a wholesaler's session takes out", () => {
    const { win } = fakeBrowser()
    client.configureAnalytics({ ...RETAIL, amounts: false }, undefined)
    client.track(viewed, null, true)

    expect(JSON.stringify(ga4Sent(win))).not.toMatch(/612|"value"/)
  })

  it("holds a page's word on the events waiting for the frame", () => {
    const { win } = fakeBrowser("https://shop.test/siparis/order_1?yeni=1")
    client.track(purchase, "purchase:order_1", false)
    client.configureAnalytics(RETAIL, undefined)

    expect(JSON.stringify(ga4Sent(win))).not.toMatch(/7350|"value"/)
    expect(metaTracked(win)).toEqual([])
  })
})
