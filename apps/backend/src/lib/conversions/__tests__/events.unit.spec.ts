import { createHash } from "node:crypto"
import { ga4Purchase, ga4Refund, metaEmail, metaPhone, metaPurchase } from "../events"
import type { ConversionOrder } from "../events"

const sha = (value: string) => createHash("sha256").update(value).digest("hex")

const ORDER: ConversionOrder = {
  id: "order_01ABC",
  email: " Ayse.Yilmaz@Example.com ",
  phone: "0532 123 45 67",
  createdAt: new Date("2026-10-29T10:00:00Z"),
  total: 1249.899,
  shipping: 49.9,
  items: [
    { id: "variant_1", title: "Kupa", price: 600, quantity: 2 },
    { id: "variant_2", title: "Tabak", price: 0.1, quantity: 1 },
  ],
}

describe("conversion events (F10.9)", () => {
  it("hashes the address and phone as Meta matches them", () => {
    expect(metaEmail(" Ayse.Yilmaz@Example.com ")).toBe(sha("ayse.yilmaz@example.com"))
    // Digits with the country code, no plus and no leading zero
    expect(metaPhone("0532 123 45 67")).toBe(sha("905321234567"))
    expect(metaPhone("0212 123 45 67")).toBe(sha("902121234567"))
    expect(metaPhone("12")).toBeNull()
  })

  it("makes the order Meta's Purchase, the browser's details as they are", () => {
    const event = metaPurchase(ORDER, {
      ip: "203.0.113.7",
      userAgent: "Mozilla/5.0",
      fbp: "fb.1.1700000000000.123",
      fbc: null,
      pageUrl: "https://magaza.example.com/sepet",
    })

    expect(event).toMatchObject({
      event_name: "Purchase",
      event_time: 1_793_268_000,
      event_id: "order_01ABC",
      action_source: "website",
      event_source_url: "https://magaza.example.com/sepet",
      user_data: {
        em: [sha("ayse.yilmaz@example.com")],
        ph: [sha("905321234567")],
        client_ip_address: "203.0.113.7",
        client_user_agent: "Mozilla/5.0",
        fbp: "fb.1.1700000000000.123",
      },
      custom_data: { currency: "TRY", value: 1249.9, num_items: 3, order_id: "order_01ABC" },
    })
    expect(event.user_data).not.toHaveProperty("fbc")
  })

  it("makes the order GA4's purchase, and a refund against the same transaction", () => {
    expect(ga4Purchase(ORDER)).toEqual({
      name: "purchase",
      params: {
        currency: "TRY",
        value: 1249.9,
        transaction_id: "order_01ABC",
        shipping: 49.9,
        items: [
          { item_id: "variant_1", item_name: "Kupa", price: 600, quantity: 2 },
          { item_id: "variant_2", item_name: "Tabak", price: 0.1, quantity: 1 },
        ],
      },
    })
    expect(ga4Refund("order_01ABC", 600.004)).toEqual({
      name: "refund",
      params: { currency: "TRY", transaction_id: "order_01ABC", value: 600 },
    })
  })
})
