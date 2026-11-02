import { describe, expect, it } from "vitest"
import type { AnalyticsEvent, AnalyticsItem } from "../events"
import { carriesSecret, ga4Event, itemsValue, metaEvent, safeLocation } from "../events"

const shirt: AnalyticsItem = {
  id: "variant_01",
  name: "Keten gömlek",
  price: 799.9,
  quantity: 2,
  brand: "Marka",
  variant: "M",
}

const purchase: AnalyticsEvent = {
  name: "purchase",
  transactionId: "order_01",
  value: 1689.8,
  shipping: 90,
  items: [shirt],
}

describe("GA4's events", () => {
  it("names a purchase by the order's id, in lira, with its items in GA4's shape", () => {
    expect(ga4Event(purchase)).toEqual([
      "purchase",
      {
        transaction_id: "order_01",
        currency: "TRY",
        value: 1689.8,
        shipping: 90,
        items: [
          {
            item_id: "variant_01",
            item_name: "Keten gömlek",
            index: 0,
            quantity: 2,
            price: 799.9,
            item_brand: "Marka",
            item_variant: "M",
          },
        ],
      },
    ])
  })

  it("sends the ecommerce events with currency and value, a search with its words", () => {
    expect(ga4Event({ name: "add_to_cart", value: 1599.8, items: [shirt] })[1]).toMatchObject({
      currency: "TRY",
      value: 1599.8,
    })
    expect(ga4Event({ name: "search", term: "gömlek" })).toEqual([
      "search",
      { search_term: "gömlek" },
    ])
    expect(ga4Event({ name: "sign_up", method: "email" })).toEqual(["sign_up", { method: "email" }])
    const [name, params] = ga4Event({
      name: "add_payment_info",
      value: 10,
      paymentType: "bank_transfer",
      items: [],
    })
    expect(name).toBe("add_payment_info")
    expect(params).toMatchObject({ payment_type: "bank_transfer" })
  })

  it("leaves out what an item does not have, and rounds to kuruş", () => {
    const [, params] = ga4Event({
      name: "view_item_list",
      listId: "brand",
      listName: "Marka",
      items: [{ id: "prod_1", name: "A", price: null, quantity: 1 }],
    })
    expect(params["items"]).toEqual([{ item_id: "prod_1", item_name: "A", index: 0, quantity: 1 }])
    expect(itemsValue([{ ...shirt, price: 0.1, quantity: 3 }])).toBe(0.3)
  })
})

describe("Meta's events", () => {
  it("gives the purchase the order's id as its event id: the server's event counts once", () => {
    expect(metaEvent(purchase)).toEqual({
      name: "Purchase",
      data: {
        content_type: "product",
        content_ids: ["variant_01"],
        contents: [{ id: "variant_01", quantity: 2, item_price: 799.9 }],
        currency: "TRY",
        value: 1689.8,
        num_items: 2,
      },
      eventID: "order_01",
    })
  })

  it("maps to Meta's standard events, and skips a list it has none for", () => {
    expect(metaEvent({ name: "view_item", value: 1, items: [shirt] })?.name).toBe("ViewContent")
    expect(metaEvent({ name: "begin_checkout", value: 1, items: [shirt] })?.data).toMatchObject({
      num_items: 2,
    })
    expect(metaEvent({ name: "search", term: "x" })).toEqual({
      name: "Search",
      data: { search_string: "x" },
    })
    expect(metaEvent({ name: "sign_up", method: "email" })?.name).toBe("CompleteRegistration")
    expect(
      metaEvent({ name: "page_view", location: "https://x", referrer: "", title: "" })?.name
    ).toBe("PageView")
    expect(metaEvent({ name: "view_item_list", listId: "a", listName: "A", items: [] })).toBeNull()
  })
})

describe("the address a tag hears", () => {
  it("drops keys and tokens, keeps the rest", () => {
    expect(
      safeLocation("https://shop.test/siparis/order_1?token=abc.def&yeni=1&utm_source=x#top")
    ).toBe("https://shop.test/siparis/order_1?yeni=1&utm_source=x")
    expect(safeLocation("https://shop.test/abonelik/cik?t=secret")).toBe(
      "https://shop.test/abonelik/cik"
    )
    expect(safeLocation("https://shop.test/hesap/dogrula?code=123456789012")).toBe(
      "https://shop.test/hesap/dogrula"
    )
    expect(safeLocation("https://shop.test/onizleme/sfl_abc.123.xyz")).toBe(
      "https://shop.test/onizleme"
    )
    expect(safeLocation("https://shop.test/arama?q=g%C3%B6mlek&sayfa=2")).toBe(
      "https://shop.test/arama?q=g%C3%B6mlek&sayfa=2"
    )
    expect(safeLocation("")).toBe("")
  })

  it("knows an address holding a key (Meta's pixel hears nothing there)", () => {
    expect(carriesSecret("https://shop.test/siparis/order_1?token=abc&yeni=1")).toBe(true)
    expect(carriesSecret("https://shop.test/onizleme/sfl_x")).toBe(true)
    expect(carriesSecret("https://shop.test/urun/gomlek?variant=variant_1")).toBe(false)
    expect(carriesSecret("")).toBe(false)
  })
})
