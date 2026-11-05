import type { MedusaRequest } from "@medusajs/framework/http"
import { StorePostGiftRecipient } from "../../store/carts/[id]/line-items/[line_id]/gift/validators"
import { refuseCoreGiftCardProducts, restrictStoreProductExtension } from "../gift-card-sale-routes"
import { fakeResponse } from "./fakes"

const withFields = (fields: unknown) =>
  ({
    method: "GET",
    path: "/store/products/prod_1",
    originalUrl: "/store/products/prod_1",
    query: { fields },
  }) as unknown as MedusaRequest

function restricted(fields: unknown): number | "next" {
  const out = fakeResponse()
  const passed = { next: false }
  restrictStoreProductExtension(withFields(fields), out.res, () => {
    passed.next = true
  })
  return passed.next ? "next" : out.status()
}

describe("a product's extension in Store fields (adr/0025 Ek 2026-11-03)", () => {
  it.each([
    "+product_extension.is_gift_card",
    "id,title,product_extension.is_gift_card",
    "items.product.product_extension.is_gift_card",
    "id,title",
    // adr/0055: the product's own description document
    "+product_extension.description_doc",
    "id,product_extension.is_gift_card,product_extension.description_doc",
    // adr/0055 Ek 2026-11-05: the product's own short description
    "+product_extension.summary",
    // adr/0052 Ek 2026-11-03: the withdrawal mark and the kind that reads it (MSY md. 5/1-h)
    "+product_extension.withdrawal_excluded,+product_extension.kind",
  ])("lets %s through", (fields) => {
    expect(restricted(fields)).toBe("next")
  })

  it.each([
    "product_extension",
    "*product_extension",
    "product_extension.*",
    "+product_extension.successor_product_id",
    "PRODUCT_EXTENSION.restriction",
    "items.product.product_extension.kind",
    "items.product.product_extension.withdrawal_excluded",
    "product_extension.withdrawal_excluded.x",
    "+product_extension.restriction",
    ["id", "product_extension.is_gift_card.x"],
    "items.product.product_extension.description_doc",
    "product_extension.description_doc.content",
    "items.product.product_extension.summary",
  ])("refuses %s", (fields) => {
    expect(restricted(fields)).toBe(400)
  })
})

describe("Medusa's own gift card mark on a product", () => {
  const ask = (body: unknown, method = "POST") => {
    let passed: unknown = "none"
    refuseCoreGiftCardProducts(
      { method, body } as unknown as MedusaRequest,
      fakeResponse().res,
      (error?: unknown) => {
        passed = error ?? null
      }
    )
    return passed
  }

  it("is refused on a product's save and in a batch, whichever way it comes", () => {
    for (const body of [
      { title: "Kart", is_giftcard: true },
      { create: [{ title: "Kart", is_giftcard: true }] },
      { update: [{ id: "prod_1", is_giftcard: true }] },
    ]) {
      expect(ask(body)).toMatchObject({ safeMessage: "catalog.core_gift_card" })
    }
  })

  it("leaves every other save alone", () => {
    expect(ask({ title: "Kupa", is_giftcard: false })).toBeNull()
    expect(ask({ is_gift_card: true })).toBeNull()
    expect(ask({ is_giftcard: true }, "GET")).toBeNull()
    expect(ask(undefined)).toBeNull()
  })
})

describe("a gift line's recipient as the Store API takes it", () => {
  const parse = (body: unknown) => StorePostGiftRecipient.safeParse(body)
  const messageOf = (body: unknown) => {
    const parsed = parse(body)
    return parsed.success ? null : parsed.error.issues[0]?.message
  }

  it("normalises the address and reads blank texts as none", () => {
    const parsed = parse({
      recipient_email: " Zeynep@Example.COM ",
      recipient_name: "  ",
      message: " İyi ki\ndoğdun! ",
    })
    expect(parsed.success && parsed.data).toEqual({
      recipient_email: "zeynep@example.com",
      recipient_name: null,
      message: "İyi ki doğdun!",
    })
  })

  it("refuses an address that is none, links, long or hidden text, and unknown fields", () => {
    expect(messageOf({ recipient_email: "zeynep" })).toBe("gift_card.recipient_email_invalid")
    expect(messageOf({ recipient_email: "z@e.co", message: "bkz. kotu.example" })).toBe(
      "gift_card.text_link"
    )
    expect(messageOf({ recipient_email: "z@e.co", sender_name: "a".repeat(61) })).toBe(
      "gift_card.text_too_long"
    )
    expect(messageOf({ recipient_email: "z@e.co", recipient_name: "a‮b" })).toBe(
      "gift_card.text_invalid"
    )
    expect(parse({ recipient_email: "z@e.co", amount: 5 }).success).toBe(false)
  })
})
