import { beforeEach, describe, expect, it, vi } from "vitest"

interface Shop {
  wholesale: { active: boolean } | Error
  tracking: Record<string, string | null>
  consent: unknown
}
const shop = vi.hoisted((): Shop => ({
  wholesale: { active: false },
  tracking: { ga4: "G-ABC123", meta: null },
  consent: null,
}))
vi.mock("../../account/wholesale", () => ({
  currentWholesale: () =>
    shop.wholesale instanceof Error
      ? Promise.reject(shop.wholesale)
      : Promise.resolve({ vatExclusive: false, minQuantity: null, ...shop.wholesale }),
}))
vi.mock("../../legal/cookies", () => ({ cookieConsent: () => Promise.resolve(shop.consent) }))
vi.mock("../../store-api/requests", () => ({
  siteSeo: () => Promise.resolve({ tracking: shop.tracking }),
}))

const { analyticsTags } = await import("../tags")

/** ADR-0068 slice 5 review L1: the server never says "amounts" for a wholesaler. */
describe("analyticsTags' amounts", () => {
  beforeEach(() => {
    shop.wholesale = { active: false }
    shop.consent = null
  })

  it("is no for a wholesaler before any tag is allowed: a page drawn then may be shown again", async () => {
    shop.wholesale = { active: true }
    const tags = await analyticsTags()
    expect([tags.ga4, tags.meta]).toEqual([null, null])
    expect(tags.amounts).toBe(false)
  })

  it("is no when the answer cannot be had, and yes for everyone else", async () => {
    shop.wholesale = new Error("backend down")
    expect((await analyticsTags()).amounts).toBe(false)
    shop.wholesale = { active: false }
    expect((await analyticsTags()).amounts).toBe(true)
  })
})
