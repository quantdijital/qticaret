import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { ga4EventWithoutAmounts, metaEventWithoutAmounts } from "../amounts"
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
const added: AnalyticsEvent = { name: "add_to_cart", value: 7350, items: [line] }

/** ADR-0068 §7, slice 3 review I2: a wholesaler's prices never reach a third party's tag. */
describe("a wholesaler's events", () => {
  it("go to GA4 without a price, a value, a currency or a shipping cost", () => {
    const [name, params] = ga4EventWithoutAmounts(purchase)
    expect(name).toBe("purchase")
    expect(params).toEqual({
      transaction_id: "order_1",
      items: [
        {
          item_id: "variant_1",
          item_name: "Şef bıçağı",
          index: 0,
          quantity: 12,
          item_brand: "Marka",
        },
      ],
    })
    expect(JSON.stringify(ga4EventWithoutAmounts(added))).not.toMatch(/612|7350|price|value/)
  })

  it("go to Meta without amounts, and a purchase not at all (Meta needs its value)", () => {
    expect(metaEventWithoutAmounts(purchase)).toBeNull()
    expect(metaEventWithoutAmounts(added)).toEqual({
      name: "AddToCart",
      data: {
        content_type: "product",
        content_ids: ["variant_1"],
        contents: [{ id: "variant_1", quantity: 12 }],
      },
    })
    expect(metaEventWithoutAmounts({ name: "search", term: "bıçak" })).toEqual({
      name: "Search",
      data: { search_string: "bıçak" },
    })
  })
})

describe("the browser in a wholesaler's session", () => {
  let client: typeof Client

  beforeEach(async () => {
    vi.resetModules()
    client = await import("../client")
  })

  afterEach(() => {
    vi.unstubAllGlobals()
  })

  it("sends both tags their events with no amount in them", () => {
    const { win } = fakeBrowser("https://shop.test/siparis/order_1?yeni=1")
    client.configureAnalytics(
      { ga4: "G-ABC123", meta: "1234567890", adSignals: true, amounts: false },
      undefined
    )
    client.track(added)
    client.track(purchase)

    const sent = layer(win).filter((call) => call[0] === "event")
    expect(sent.map((call) => call[1])).toEqual(["add_to_cart", "purchase"])
    expect(JSON.stringify(sent)).not.toMatch(/612|7350|"value"|"price"|"currency"/)
    const tracked = metaCalls(win).filter((call) => call[0] === "track")
    expect(tracked.map((call) => call[1])).toEqual(["AddToCart"])
    expect(JSON.stringify(tracked)).not.toMatch(/612|7350|value|item_price/)
  })

  it("keeps the amounts for everyone else", () => {
    const { win } = fakeBrowser()
    client.configureAnalytics(
      { ga4: "G-ABC123", meta: null, adSignals: false, amounts: true },
      undefined
    )
    client.track(added)
    expect(layer(win).find((call) => call[1] === "add_to_cart")?.[2]).toMatchObject({
      currency: "TRY",
      value: 7350,
    })
  })
})
