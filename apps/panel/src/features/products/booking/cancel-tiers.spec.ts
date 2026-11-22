import { describe, expect, it } from "vitest"
import { nextTier, tierDraftsOf, tiersInputOf, tiersSchema } from "./cancel-tiers"

const row = (days: string, percent: string) => ({ days_before: days, fee_percent: percent })

describe("cancellation tiers", () => {
  it("reads stored tiers the most days first and saves them as numbers", () => {
    const drafts = tierDraftsOf([
      { days_before: 7, fee_percent: 50 },
      { days_before: 30, fee_percent: 0 },
    ])
    expect(drafts).toEqual([row("30", "0"), row("7", "50")])
    expect(tiersInputOf([row("7", "50"), row("30", "0")])).toEqual([
      { days_before: 30, fee_percent: 0 },
      { days_before: 7, fee_percent: 50 },
    ])
    expect(tierDraftsOf(undefined)).toEqual([])
  })

  it("refuses a share out of 0–100, a repeated day count and less kept nearer the date", () => {
    expect(tiersSchema.safeParse([row("30", "101")]).error?.issues[0]?.message).toBe(
      "products.booking.errors.form.tierPercent"
    )
    expect(tiersSchema.safeParse([row("7", "10"), row("7", "20")]).error?.issues[0]).toMatchObject({
      path: [1, "days_before"],
      message: "products.booking.errors.form.tierSame",
    })
    expect(tiersSchema.safeParse([row("30", "50"), row("7", "20")]).error?.issues[0]).toMatchObject(
      { path: [1, "fee_percent"], message: "products.booking.errors.form.tierOrder" }
    )
    expect(tiersSchema.safeParse([row("30", "0"), row("7", "50"), row("0", "100")]).success).toBe(
      true
    )
    const eleven = Array.from({ length: 11 }, (_, index) => row(String(index), "100"))
    expect(tiersSchema.safeParse(eleven).success).toBe(false)
  })

  it("offers a next row nearer the date that keeps more", () => {
    expect(nextTier([])).toEqual(row("30", "0"))
    expect(nextTier([row("30", "0")])).toEqual(row("15", "25"))
    expect(nextTier([row("1", "90")])).toEqual(row("0", "100"))
  })
})
