import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { giftCardCodes } from "../gift-card-codes"

interface Outcome {
  body: unknown
  error: unknown
}

// Mounted with `app.use`, so the full path is only in `originalUrl`
function run(path: string, body: unknown, method = "POST"): Outcome {
  const req = { method, originalUrl: path, path: "/", body } as unknown as MedusaRequest
  let error: unknown = "next not called"
  giftCardCodes(req, {} as MedusaResponse, (passed?: unknown) => {
    error = passed
  })
  return { body: req.body, error }
}

const code = (outcome: Outcome): unknown => (outcome.body as { code?: unknown }).code

describe("giftCardCodes", () => {
  it.each([undefined, null, "", "  "])("gives a card made with code %p one of its own", (sent) => {
    const outcome = run("/admin/gift-cards", { currency_code: "try", value: 100, code: sent })
    expect(outcome.error).toBeUndefined()
    expect(code(outcome)).toMatch(/^GIFT(-[2-9A-HJ-NP-Z]{4}){4}$/u)
  })

  it("puts a shop's own word in front of the random part, never instead of it", () => {
    expect(code(run("/ADMIN/gift-cards/", { code: " yılbaşı- " }))).toMatch(
      /^YILBASI(-[2-9A-HJ-NP-Z]{4}){4}$/u
    )
    for (const sent of ["YIL BASI", "A".repeat(21)]) {
      const refused = run("/admin/gift-cards", { code: sent })
      expect((refused.error as { safeMessage?: string }).safeMessage).toBe("gift_cards.code_prefix")
    }
  })

  it("reads a shopper's code as the shop keeps it", () => {
    expect(code(run("/store/carts/cart_01A/gift-cards", { code: " gift-abcd-efgh " }))).toBe(
      "GIFT-ABCD-EFGH"
    )
    expect(code(run("/store/carts/cart_01A/gift-cards", { code: "gift-x" }, "DELETE"))).toBe(
      "GIFT-X"
    )
  })

  it("leaves other routes, methods and bodies as they are", () => {
    expect(run("/admin/gift-cards/gcard_01A", { note: "x" }).body).toEqual({ note: "x" })
    expect(run("/admin/gift-cards", undefined, "GET").body).toBeUndefined()
    expect(run("/store/carts/cart_01A/gift-cards", { code: 5 }).body).toEqual({ code: 5 })
    expect(run("/store/carts/cart_01A/gift-cards", { code: "ab" }, "PUT").body).toEqual({
      code: "ab",
    })
  })
})
