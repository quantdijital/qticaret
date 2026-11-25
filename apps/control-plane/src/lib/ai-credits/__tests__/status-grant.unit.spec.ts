import { aiCreditsStatusSchema } from "@qticaret/types/control-plane"
import type { AiCreditsStatus } from "@qticaret/types/control-plane"
import { monthlyGrantOf } from "../rollover"
import { withMonthlyGrant } from "../status-grant"

jest.mock("../rollover", () => ({ monthlyGrantOf: jest.fn() }))

const grantOf = jest.mocked(monthlyGrantOf)
const container = { resolve: jest.fn() }
const now = new Date("2026-11-25T09:00:00.000Z")

const statusWith = (plan: { remaining: number; granted?: number }): AiCreditsStatus => ({
  available: true,
  balance: {
    plan: { renews_on: "2026-12-01", ...plan },
    purchased: { remaining: 0, expires_on: null },
  },
  daily: { cap: 300, remaining: 300 },
  services: { text: "deepseek" },
  table: { seo_title: 1 },
  packs: [],
  pending_order: null,
})

/** P5b: the shop's status carries its month's whole grant, read from its package. */
describe("withMonthlyGrant", () => {
  beforeEach(() => grantOf.mockReset())

  it("adds the package's grant to an available status and changes nothing else", async () => {
    grantOf.mockResolvedValue(100)
    const status = await withMonthlyGrant(container, "ten_a", now, statusWith({ remaining: 60 }))
    expect(status).toEqual(statusWith({ remaining: 60, granted: 100 }))
    expect(aiCreditsStatusSchema.parse(status)).toEqual(status)
    expect(grantOf).toHaveBeenCalledWith(container, "ten_a", now)
  })

  it("says 0 for a package that gives no grant", async () => {
    grantOf.mockResolvedValue(0)
    expect(await withMonthlyGrant(container, "ten_a", now, statusWith({ remaining: 0 }))).toEqual(
      statusWith({ remaining: 0, granted: 0 })
    )
  })

  it("never names a whole smaller than what is left (a package lowered mid-month)", async () => {
    grantOf.mockResolvedValue(40)
    expect(await withMonthlyGrant(container, "ten_a", now, statusWith({ remaining: 60 }))).toEqual(
      statusWith({ remaining: 60, granted: 60 })
    )
  })

  it("leaves an unavailable status as it is and reads no package", async () => {
    const off: AiCreditsStatus = { available: false }
    expect(await withMonthlyGrant(container, "ten_a", now, off)).toEqual({ available: false })
    expect(grantOf).not.toHaveBeenCalled()
  })
})
