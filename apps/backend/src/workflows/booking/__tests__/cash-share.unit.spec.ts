import { cashShareFee } from "../cash-share"

const terms = {
  timezone: "Europe/Istanbul",
  tiers: [
    { days_before: 30, fee_percent: 10 },
    { days_before: 7, fee_percent: 20 },
    { days_before: 0, fee_percent: 100 },
  ],
}
const startsAt = new Date("2026-12-10T09:00:00Z")
const DAY = 24 * 60 * 60 * 1000

describe("the share kept from a cancelled departure's cash (review O1 of #277)", () => {
  it("keeps nothing when the shop cancelled the departure", () => {
    expect(
      cashShareFee({
        slot_status: "cancelled",
        terms,
        starts_at: startsAt,
        cancelled_at: new Date(startsAt.getTime() - DAY),
        package_travel: false,
      })
    ).toBe(0)
  })

  it("keeps the tier sold for the days left when it was cancelled", () => {
    const at = (days: number) =>
      cashShareFee({
        slot_status: "open",
        terms,
        starts_at: startsAt,
        cancelled_at: new Date(startsAt.getTime() - days * DAY),
        package_travel: false,
      })

    expect(at(10)).toBe(20)
    expect(at(40)).toBe(10)
    expect(at(0)).toBe(100)
  })

  it("keeps nothing under package travel 30 days ahead, nor with no tier", () => {
    const ahead = new Date(startsAt.getTime() - 40 * DAY)

    expect(
      cashShareFee({
        slot_status: "open",
        terms,
        starts_at: startsAt,
        cancelled_at: ahead,
        package_travel: true,
      })
    ).toBe(0)
    expect(
      cashShareFee({
        slot_status: "open",
        terms: { ...terms, tiers: [] },
        starts_at: startsAt,
        cancelled_at: ahead,
        package_travel: false,
      })
    ).toBe(0)
  })
})
