import {
  PACKAGE_TRAVEL_FREE_DAYS,
  cancellationTermsOf,
  daysBefore,
  effectiveTiers,
  feeRuleFor,
} from "../cancellation"
import { CancellationTiers } from "../settings"

const tiers = [
  { days_before: 30, fee_percent: 10 },
  { days_before: 7, fee_percent: 50 },
  { days_before: 2, fee_percent: 100 },
]

describe("daysBefore (adr/0076 D7a)", () => {
  it("counts calendar days in the product's zone, whatever the hour", () => {
    const start = new Date("2027-05-10T04:00:00Z") // 07:00 in Istanbul

    expect(daysBefore(start, new Date("2027-05-09T20:59:00Z"))).toBe(1) // 23:59 the day before
    expect(daysBefore(start, new Date("2027-05-09T21:00:00Z"))).toBe(0) // 00:00 on the day
    expect(daysBefore(start, new Date("2027-05-11T10:00:00Z"))).toBe(-1)
    expect(daysBefore(start, new Date("2027-04-10T10:00:00Z"))).toBe(30)
  })

  it("reads the day in another zone", () => {
    const start = new Date("2027-05-10T02:00:00Z")

    expect(daysBefore(start, new Date("2027-05-09T23:00:00Z"), "UTC")).toBe(1)
    expect(daysBefore(start, new Date("2027-05-09T23:00:00Z"), "Europe/Istanbul")).toBe(0)
  })
})

describe("feeRuleFor (adr/0076 §8)", () => {
  it("takes the tier with the most days not above the days left", () => {
    expect(feeRuleFor(tiers, 45, { packageTravel: false })).toEqual({
      fee_percent: 10,
      days_before: 30,
    })
    expect(feeRuleFor(tiers, 30, { packageTravel: false })?.fee_percent).toBe(10)
    expect(feeRuleFor(tiers, 29, { packageTravel: false })?.fee_percent).toBe(50)
    expect(feeRuleFor(tiers, 7, { packageTravel: false })?.fee_percent).toBe(50)
    expect(feeRuleFor(tiers, 2, { packageTravel: false })?.fee_percent).toBe(100)
  })

  it("goes on with the closest tier below every tier and after the day", () => {
    expect(feeRuleFor(tiers, 1, { packageTravel: false })?.fee_percent).toBe(100)
    expect(feeRuleFor(tiers, -3, { packageTravel: false })?.fee_percent).toBe(100)
    expect(feeRuleFor([{ days_before: 10, fee_percent: 20 }], 3, { packageTravel: false })).toEqual(
      { fee_percent: 20, days_before: 10 }
    )
  })

  it("offers no self-service cancel without a tier, unless the floor applies", () => {
    expect(feeRuleFor([], 60, { packageTravel: false })).toBeNull()
    expect(feeRuleFor(null, 60, { packageTravel: false })).toBeNull()
    expect(feeRuleFor([], PACKAGE_TRAVEL_FREE_DAYS, { packageTravel: true })).toEqual({
      fee_percent: 0,
      days_before: null,
    })
    expect(feeRuleFor([], 29, { packageTravel: true })).toBeNull()
  })

  it("keeps nothing 30 days or more ahead for a package travel seller, whatever its tiers", () => {
    const greedy = [
      { days_before: 60, fee_percent: 20 },
      { days_before: 30, fee_percent: 40 },
      { days_before: 10, fee_percent: 80 },
    ]

    expect(feeRuleFor(greedy, 90, { packageTravel: true })?.fee_percent).toBe(0)
    expect(feeRuleFor(greedy, 30, { packageTravel: true })?.fee_percent).toBe(0)
    expect(feeRuleFor(greedy, 29, { packageTravel: true })?.fee_percent).toBe(80)
    expect(feeRuleFor(greedy, 90, { packageTravel: false })?.fee_percent).toBe(20)
  })

  it("ties the floor to the days left, not to the tier reached (review D1)", () => {
    // Every tier 30 days or more out: closer than that the closest tier's share is kept
    const farOnly = [
      { days_before: 45, fee_percent: 30 },
      { days_before: 30, fee_percent: 50 },
    ]
    expect(feeRuleFor(farOnly, 31, { packageTravel: true })?.fee_percent).toBe(0)
    expect(feeRuleFor(farOnly, 29, { packageTravel: true })).toEqual({
      fee_percent: 50,
      days_before: 30,
    })
    expect(feeRuleFor(farOnly, 0, { packageTravel: true })?.fee_percent).toBe(50)
  })

  it("shows the tiers under the floor", () => {
    expect(effectiveTiers(tiers, true)).toEqual([
      { days_before: 30, fee_percent: 0 },
      { days_before: 7, fee_percent: 50 },
      { days_before: 2, fee_percent: 100 },
    ])
    expect(effectiveTiers(tiers, false)[0]?.fee_percent).toBe(10)
  })
})

describe("CancellationTiers", () => {
  it("takes whole percents 0–100 that never fall closer to the day", () => {
    expect(CancellationTiers.safeParse(tiers).success).toBe(true)
    expect(CancellationTiers.safeParse([...tiers].reverse()).success).toBe(true)
    expect(
      CancellationTiers.safeParse([
        { days_before: 30, fee_percent: 50 },
        { days_before: 7, fee_percent: 20 },
      ]).success
    ).toBe(false)
    expect(CancellationTiers.safeParse([{ days_before: 3, fee_percent: 101 }]).success).toBe(false)
    expect(CancellationTiers.safeParse([{ days_before: 3, fee_percent: 12.5 }]).success).toBe(false)
    expect(
      CancellationTiers.safeParse([
        { days_before: 3, fee_percent: 10 },
        { days_before: 3, fee_percent: 20 },
      ]).success
    ).toBe(false)
  })
})

describe("cancellationTermsOf (review O5)", () => {
  const live = { timezone: "Europe/Berlin", tiers: [{ days_before: 0, fee_percent: 100 }] }

  it("reckons by the terms copied when the booking was confirmed", () => {
    expect(cancellationTermsOf({ timezone: "Europe/Istanbul", tiers }, live)).toEqual({
      timezone: "Europe/Istanbul",
      tiers,
    })
  })

  it("keeps a copy of no tiers: the shop sold it with none", () => {
    expect(cancellationTermsOf({ timezone: "Europe/Istanbul", tiers: [] }, live).tiers).toEqual([])
  })

  it("falls back to the product's settings now for a booking without a copy", () => {
    expect(cancellationTermsOf(null, live)).toEqual(live)
    expect(cancellationTermsOf(undefined, { timezone: null, tiers: null })).toEqual({
      timezone: "Europe/Istanbul",
      tiers: [],
    })
  })

  it("never trusts a copy that does not read as terms", () => {
    expect(cancellationTermsOf({ timezone: "Mars/Olympus", tiers }, live)).toEqual(live)
    expect(
      cancellationTermsOf({ timezone: "Europe/Istanbul", tiers: [{ days_before: -1 }] }, live)
    ).toEqual(live)
    expect(cancellationTermsOf("text", live)).toEqual(live)
  })
})
