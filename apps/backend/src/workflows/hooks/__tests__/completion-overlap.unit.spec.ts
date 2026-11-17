import { CART_LOCK_TTL_MS, overlapsPlacement } from "../completion-overlap"

const NOW = Date.parse("2026-11-17T10:00:00Z")
const ago = (ms: number) => new Date(NOW - ms)

describe("a run Medusa's cart lock did not hold back stops before a second order (review N1)", () => {
  it("stops a run that read the cart before another placed its order just now", () => {
    const cart = { id: "cart_01", completed_at: null }

    expect(overlapsPlacement(cart, { created_at: ago(1_000) }, NOW)).toBe(true)
    expect(overlapsPlacement(cart, { created_at: ago(1_000).toISOString() }, NOW)).toBe(true)
  })

  it("answers as before a cart Medusa read completed: a repeat it answers with that order", () => {
    const cart = { id: "cart_01", completed_at: ago(500) }

    expect(overlapsPlacement(cart, { created_at: ago(1_000) }, NOW)).toBe(false)
  })

  it("never loops on a cart a crash left with an order and no completed_at", () => {
    const cart = { id: "cart_01", completed_at: null }

    // Tried again only while the order is younger than the lock's TTL, then answered as before
    expect(overlapsPlacement(cart, { created_at: ago(CART_LOCK_TTL_MS - 1) }, NOW)).toBe(true)
    expect(overlapsPlacement(cart, { created_at: ago(CART_LOCK_TTL_MS) }, NOW)).toBe(false)
    expect(overlapsPlacement(cart, { created_at: ago(24 * 60 * 60 * 1000) }, NOW)).toBe(false)
  })

  it("answers as before an order whose time cannot be read", () => {
    const cart = { id: "cart_01" }

    expect(overlapsPlacement(cart, {}, NOW)).toBe(false)
    expect(overlapsPlacement(cart, { created_at: null }, NOW)).toBe(false)
    expect(overlapsPlacement(cart, { created_at: "not a date" }, NOW)).toBe(false)
  })
})
