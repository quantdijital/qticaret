import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { bestSellerIds, bestSellersStatement } from "../best-sellers"

// The statement itself runs against Medusa's tables in http/storefront-rails.spec.ts
describe("best sellers (adr/0049 Ek 2026-11-05)", () => {
  it("counts the order's current version, paid sales only, returned units off", () => {
    const sql = bestSellersStatement(false)
    expect(sql).toContain("oi.version = o.version")
    expect(sql).toContain("o.status::text NOT IN ('draft', 'archived', 'canceled')")
    expect(sql).toContain("o.canceled_at IS NULL")
    expect(sql).toContain(
      "pc.status IN ('authorized', 'partially_authorized', 'partially_captured', 'completed')"
    )
    expect(sql).toContain("GREATEST(oi.quantity - oi.return_received_quantity, 0)")
    expect(sql).toContain("p.status = 'published' AND p.deleted_at IS NULL")
    expect(sql).not.toContain("product_sales_channel")
    // The window, then the rail's most: every value bound
    expect(sql.match(/\?/g)).toHaveLength(2)
  })

  it("narrows to the shopper's sales channels when it has them", () => {
    const sql = bestSellersStatement(true)
    expect(sql).toContain("product_sales_channel psc")
    expect(sql.match(/\?/g)).toHaveLength(3)
  })

  it("binds the window and channels, and holds a ranking per window and channels", async () => {
    const raw = jest.fn().mockResolvedValue({ rows: [{ product_id: "prod_b" }] })
    const container = {
      resolve: (key: string) => {
        expect(key).toBe(ContainerRegistrationKeys.PG_CONNECTION)
        return { raw }
      },
    }
    const now = new Date("2026-11-05T12:00:00Z")

    expect(await bestSellerIds(container, 30, ["sc_2", "sc_1"], now)).toEqual(["prod_b"])
    expect(raw).toHaveBeenCalledWith(expect.stringContaining("product_sales_channel"), [
      new Date("2026-10-06T12:00:00Z"),
      JSON.stringify(["sc_2", "sc_1"]),
      24,
    ])
    // The same channels in another order: the ranking held
    expect(await bestSellerIds(container, 30, ["sc_1", "sc_2"], now)).toEqual(["prod_b"])
    expect(raw).toHaveBeenCalledTimes(1)
    // Another window is another ranking
    await bestSellerIds(container, 31, ["sc_1", "sc_2"], now)
    expect(raw).toHaveBeenCalledTimes(2)
  })
})
