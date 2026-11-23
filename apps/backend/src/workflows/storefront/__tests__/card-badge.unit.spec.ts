import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { SECTIONS } from "../../../modules/platform-settings/sections"
import type { ProductBadgeSettings } from "../../../modules/platform-settings/sections"
import { soldAtLeastStatement } from "../best-sellers"
import { anyBadgeOn, badgeOf, cardBadges, isNewProduct } from "../card-badge"

const NOW = new Date("2026-11-24T12:00:00Z")
const OFF: ProductBadgeSettings = SECTIONS.product_badges.defaults
const ALL_ON: ProductBadgeSettings = {
  ...OFF,
  manual_enabled: true,
  new_enabled: true,
  best_seller_enabled: true,
}
const daysAgo = (days: number) => new Date(NOW.getTime() - days * 24 * 60 * 60 * 1000)

describe("product badges (the owner, 2026-11-24)", () => {
  const product = {
    id: "prod_1",
    created_at: daysAgo(3),
    product_extension: { badge: "  Erken   rezervasyon " },
  }

  it("starts with every badge off", () => {
    expect(OFF).toEqual({
      manual_enabled: false,
      new_enabled: false,
      new_days: 30,
      best_seller_enabled: false,
      best_seller_min_units: 10,
    })
    expect(anyBadgeOn(OFF)).toBe(false)
    expect(badgeOf(product, OFF, new Set(["prod_1"]), NOW)).toBeNull()
  })

  it("puts the product's own line first, then best seller, then new", () => {
    const sellers = new Set(["prod_1"])
    expect(badgeOf(product, ALL_ON, sellers, NOW)).toEqual({
      kind: "manual",
      text: "Erken rezervasyon",
    })
    const plain = { ...product, product_extension: { badge: null } }
    expect(badgeOf(plain, ALL_ON, sellers, NOW)).toEqual({ kind: "best_seller" })
    expect(badgeOf(plain, ALL_ON, new Set(), NOW)).toEqual({ kind: "new" })
    expect(badgeOf({ ...plain, created_at: daysAgo(40) }, ALL_ON, new Set(), NOW)).toBeNull()
  })

  it("leaves out each kind the shop has off", () => {
    const sellers = new Set(["prod_1"])
    expect(badgeOf(product, { ...ALL_ON, manual_enabled: false }, sellers, NOW)).toEqual({
      kind: "best_seller",
    })
    expect(
      badgeOf(
        product,
        { ...ALL_ON, manual_enabled: false, best_seller_enabled: false },
        sellers,
        NOW
      )
    ).toEqual({ kind: "new" })
    expect(badgeOf(product, { ...OFF, best_seller_enabled: true }, new Set(), NOW)).toBeNull()
  })

  it("ignores a stored line that is not one (too long, control characters)", () => {
    const long = { ...product, product_extension: { badge: "x".repeat(25) } }
    const broken = { ...product, product_extension: { badge: "Yeni\u0007" } }
    const manual = { ...OFF, manual_enabled: true }
    expect(badgeOf(long, manual, new Set(), NOW)).toBeNull()
    expect(badgeOf(broken, manual, new Set(), NOW)).toBeNull()
  })

  it("reads new by the shop's days, a date it cannot read as not new", () => {
    expect(isNewProduct(daysAgo(30), 30, NOW)).toBe(true)
    expect(isNewProduct(daysAgo(31), 30, NOW)).toBe(false)
    expect(isNewProduct(daysAgo(6).toISOString(), 7, NOW)).toBe(true)
    expect(isNewProduct(null, 30, NOW)).toBe(false)
    expect(isNewProduct("not a date", 30, NOW)).toBe(false)
  })

  it("asks the sales once for a page, only while best seller is on", async () => {
    const raw = jest.fn().mockResolvedValue({ rows: [{ product_id: "prod_2" }] })
    const container = {
      resolve: (key: string) => {
        expect(key).toBe(ContainerRegistrationKeys.PG_CONNECTION)
        return { raw }
      },
    }
    const products = [
      { id: "prod_1", created_at: daysAgo(100) },
      { id: "prod_2", created_at: daysAgo(100) },
    ]
    expect(await cardBadges(container, products, { ...OFF, new_enabled: true }, NOW)).toEqual(
      new Map()
    )
    expect(raw).not.toHaveBeenCalled()

    const on = { ...OFF, best_seller_enabled: true, best_seller_min_units: 7 }
    const found = await cardBadges(container, products, on, NOW)
    expect([...found]).toEqual([["prod_2", { kind: "best_seller" }]])
    expect(raw).toHaveBeenCalledWith(soldAtLeastStatement(), [daysAgo(30), 7])
    // Held for the next page
    await cardBadges(container, products, on, NOW)
    expect(raw).toHaveBeenCalledTimes(1)
  })

  it("counts paid sales only and gives ids, never amounts or customers", () => {
    const sql = soldAtLeastStatement()
    expect(sql).toContain("oi.version = o.version")
    expect(sql).toContain("o.canceled_at IS NULL")
    expect(sql).toContain("HAVING sum(GREATEST(oi.quantity - oi.return_received_quantity, 0)) >= ?")
    expect(sql).not.toContain("customer")
    expect(sql.match(/\?/g)).toHaveLength(2)
  })
})
