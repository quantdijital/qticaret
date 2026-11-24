import { logger } from "../../../lib/logging"
import { SOLD_AT_LEAST_CAP, soldAtLeastIds } from "../best-sellers"

jest.mock("../../../lib/logging", () => ({ logger: { warn: jest.fn() } }))

// "Çok satan" (product badges): one held read for the shop, bounded
describe("soldAtLeastIds", () => {
  it("keeps the most sold up to the cap and says so once a process", async () => {
    const rows = Array.from({ length: SOLD_AT_LEAST_CAP + 1 }, (_, index) => ({
      product_id: `prod_${String(index)}`,
    }))
    const raw = jest.fn().mockResolvedValue({ rows })
    const container = { resolve: () => ({ raw }) }
    const now = new Date("2026-11-24T12:00:00Z")

    const first = await soldAtLeastIds(container, 30, 1, now)
    // Another least is another read; the warning is not said again
    const second = await soldAtLeastIds(container, 30, 2, now)

    expect(first.size).toBe(SOLD_AT_LEAST_CAP)
    expect(first.has(`prod_${String(SOLD_AT_LEAST_CAP)}`)).toBe(false)
    expect(second.size).toBe(SOLD_AT_LEAST_CAP)
    expect(raw).toHaveBeenCalledTimes(2)
    expect(logger.warn).toHaveBeenCalledTimes(1)
    expect(logger.warn).toHaveBeenCalledWith({
      event: "storefront.best_seller_cap",
      cap: SOLD_AT_LEAST_CAP,
      min_units: 1,
    })
  })

  it("says nothing under the cap", async () => {
    const raw = jest.fn().mockResolvedValue({ rows: [{ product_id: "prod_1" }] })
    jest.mocked(logger.warn).mockClear()
    const found = await soldAtLeastIds({ resolve: () => ({ raw }) }, 30, 50)
    expect([...found]).toEqual(["prod_1"])
    expect(logger.warn).not.toHaveBeenCalled()
  })
})
