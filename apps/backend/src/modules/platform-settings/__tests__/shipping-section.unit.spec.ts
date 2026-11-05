import { shippingSection } from "../sections/shipping"
import { mergePatch } from "../sections/define"

const { full, patch, defaults } = shippingSection

const saved = (body: Record<string, unknown>) => full.safeParse(mergePatch(defaults, body))

describe("shipping section: the default parcel (adr/0054)", () => {
  it("starts with none of the shop's own: the platform's parcel stands in", () => {
    expect(defaults.default_parcel).toBeNull()
    expect(full.safeParse(defaults).success).toBe(true)
  })

  it("takes four values above zero in the shop's units, or none again", () => {
    const parcel = { weight: 0.75, length: 30, width: 20, height: 10 }

    expect(saved({ default_parcel: parcel }).data?.default_parcel).toEqual(parcel)
    expect(saved({ default_parcel: null }).success).toBe(true)
    expect(patch.safeParse({ default_parcel: parcel }).success).toBe(true)
  })

  it("refuses a parcel missing a value, one at zero or below, or past a tonne", () => {
    const parcel = { weight: 1000, length: 30, width: 20, height: 10 }

    expect(patch.safeParse({ default_parcel: { weight: 1000 } }).success).toBe(false)
    expect(saved({ default_parcel: { ...parcel, height: 0 } }).success).toBe(false)
    expect(saved({ default_parcel: { ...parcel, weight: -1 } }).success).toBe(false)
    expect(saved({ default_parcel: { ...parcel, weight: 1_000_001 } }).success).toBe(false)
    expect(saved({ default_parcel: { ...parcel, depth: 5 } }).success).toBe(false)
  })
})

describe("shipping section: the same-day hour (adr/0046 Ek 2026-11-06)", () => {
  it("starts unset, so the hour set under the feed rules before stands", () => {
    expect(defaults.same_day_cutoff_hour).toBeNull()
  })

  it("takes a whole hour of the day, or none again", () => {
    expect(saved({ same_day_cutoff_hour: 15 }).data?.same_day_cutoff_hour).toBe(15)
    expect(saved({ same_day_cutoff_hour: null }).success).toBe(true)
    expect(patch.safeParse({ same_day_cutoff_hour: 23 }).success).toBe(true)
  })

  it("refuses an hour outside the day or between hours", () => {
    expect(saved({ same_day_cutoff_hour: 0 }).success).toBe(false)
    expect(saved({ same_day_cutoff_hour: 24 }).success).toBe(false)
    expect(saved({ same_day_cutoff_hour: 15.5 }).success).toBe(false)
    expect(saved({ same_day_cutoff_hour: "15" }).success).toBe(false)
  })
})
