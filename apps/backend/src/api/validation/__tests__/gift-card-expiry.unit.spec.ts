import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { cardsWithoutExpiry } from "../gift-card-expiry"

// Mounted with `app.use`, so the full path is only in `originalUrl`
function run(path: string, body: unknown, method = "POST"): unknown {
  const req = { method, originalUrl: path, path: "/", body } as unknown as MedusaRequest
  let passed: unknown = "next not called"
  cardsWithoutExpiry(req, {} as MedusaResponse, (error?: unknown) => {
    passed = error
  })
  return passed
}

describe("cardsWithoutExpiry", () => {
  it.each(["/admin/gift-cards", "/admin/gift-cards/gc_01", "/ADMIN/gift-cards/"])(
    "refuses a last day on %s",
    (path) => {
      const error = run(path, { value: 100, expires_at: "2026-12-31T20:59:59.000Z" })
      expect((error as { safeMessage?: string }).safeMessage).toBe("gift_cards.no_expiry")
    }
  )

  it.each([undefined, null])("lets a card through with expires_at %p", (lastDay) => {
    expect(run("/admin/gift-cards", { value: 100, expires_at: lastDay })).toBeUndefined()
  })

  it("leaves other routes and reads alone", () => {
    const body = { expires_at: "2026-12-31" }
    expect(run("/admin/gift-cards/gc_01/redeem", body)).toBeUndefined()
    expect(run("/admin/store-credit-accounts", body)).toBeUndefined()
    expect(run("/admin/gift-cards", body, "GET")).toBeUndefined()
  })
})
