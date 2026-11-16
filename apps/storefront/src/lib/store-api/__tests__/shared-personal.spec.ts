import { readdirSync, readFileSync } from "node:fs"
import { join } from "node:path"
import { describe, expect, it, vi } from "vitest"
import { isPersonalPath, personalPriceIn } from "../personal"
import { storeCaches } from "../registry"
import { shared } from "../shared"

vi.mock("server-only", () => ({}))

const retail = {
  current: "100.00",
  regular: "100.00",
  before: null,
  on_sale: false,
  since: null,
  basis: null,
  rule_version: "1",
  cart_offer: null,
}
// As `wholesaleDisplay()` makes it from the personal route's answer
const wholesale = {
  ...retail,
  current: "50.00",
  regular: "50.00",
  rule_version: "wholesale",
  vat_exclusive: true,
  gross: "60.00",
}

/**
 * ADR-0068 §7, slice 3 review I3: the shared cache keeps shop-wide answers
 * for every shopper; a customer's own route and a wholesaler's price
 * (`vat_exclusive`) never enter it, however a later change routes them.
 */
describe("the shared cache and a wholesaler's prices", () => {
  it("refuses a customer's own route before asking the backend", async () => {
    const load = vi.fn(() => Promise.resolve({}))
    await expect(
      shared('/store/customers/me/wholesale-prices?{"variant_id":["v"]}', load)
    ).rejects.toThrow("customer's own route")
    await expect(shared("/store/customers/me/wholesale?{}", load)).rejects.toThrow()
    expect(load).not.toHaveBeenCalled()
    expect(storeCaches().shared.has("/store/customers/me/wholesale?{}")).toBe(false)
  })

  it("fails every waiting caller, and keeps nothing, when an answer holds a wholesaler's price", async () => {
    const key = '/store/price-display?{"variant_id":["v"]}#leak'
    const load = vi.fn(() => Promise.resolve({ price_display: { v: wholesale } }))
    const first = shared(key, load)
    const second = shared(key, load)
    await expect(first).rejects.toThrow("wholesaler's price")
    await expect(second).rejects.toThrow("wholesaler's price")
    await Promise.resolve()
    expect(storeCaches().shared.has(key)).toBe(false)
    expect(load).toHaveBeenCalledTimes(1)
  })

  it("keeps a retail price display as before", async () => {
    const key = '/store/price-display?{"variant_id":["r"]}#retail'
    await expect(
      shared(key, () => Promise.resolve({ price_display: { r: retail } }))
    ).resolves.toEqual({ price_display: { r: retail } })
    expect(storeCaches().shared.has(key)).toBe(true)
  })

  it("finds a wholesaler's price at any depth, and says when it could not look", () => {
    expect(personalPriceIn({ a: [{ b: { c: [wholesale] } }] })).toBe("yes")
    expect(personalPriceIn({ a: [{ b: { c: [retail] } }], vat_exclusive: false })).toBe("no")
    expect(personalPriceIn(null)).toBe("no")
    expect(personalPriceIn({ wholesale_prices: { v: { net: "1.00" } } })).toBe("yes")
    // A shop's own metadata key of that name is no price (review L3)
    expect(personalPriceIn({ product: { metadata: { vat_exclusive: true } } })).toBe("no")
    expect(personalPriceIn(Array.from({ length: 300_000 }, () => 1))).toBe("unknown")
    expect(isPersonalPath("/store/customers/me")).toBe(true)
    expect(isPersonalPath("/store/customers")).toBe(true)
    expect(isPersonalPath("/store/customer-groups")).toBe(false)
    expect(isPersonalPath("/store/price-display")).toBe(false)
  })
})

/** Every source file of the storefront, tests left out. */
function sources(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) {
      return entry.name === "__tests__" || entry.name === "test" ? [] : sources(path)
    }
    return /\.(ts|tsx)$/.test(entry.name) && !/\.spec\.tsx?$/.test(entry.name) ? [path] : []
  })
}

describe("the storefront's caches", () => {
  it("use none of Next's own data caches: every page is made per request (adr/0046 §2)", () => {
    const root = join(import.meta.dirname, "..", "..", "..")
    const cached = sources(root).filter((path) =>
      /\bunstable_cache\b|["']use cache["']|\bcacheLife\(|\bcacheTag\(/.test(
        readFileSync(path, "utf8")
      )
    )
    // A Next cache keyed without the session would hand one shopper's prices to the next
    expect(cached).toEqual([])
  })
})
