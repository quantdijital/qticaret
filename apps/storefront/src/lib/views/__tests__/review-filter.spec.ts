import { describe, expect, it } from "vitest"
import type { ShopRatingView } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { reviewFilterView, reviewsPath, starsOf } from "../review-filter"

const summary: ShopRatingView = {
  average: "4,6",
  count: 30,
  label: "5 üzerinden 4,6 (30 değerlendirme)",
  distribution: [
    { stars: 5, count: 24, percent: 80, label: "5 yıldız: 24 değerlendirme" },
    { stars: 4, count: 5, percent: 17, label: "4 yıldız: 5 değerlendirme" },
    { stars: 3, count: 1, percent: 3, label: "3 yıldız: 1 değerlendirme" },
    { stars: 2, count: 0, percent: 0, label: "2 yıldız: 0 değerlendirme" },
    { stars: 1, count: 0, percent: 0, label: "1 yıldız: 0 değerlendirme" },
  ],
}

describe("the reviews page's star filter (adr/0037 Ek 2026-11-05)", () => {
  it("reads one number of stars from ?puan=, and tells a wrong one from none", () => {
    expect(starsOf({})).toBeUndefined()
    expect(starsOf({ puan: "5" })).toBe(5)
    expect(starsOf({ puan: "1" })).toBe(1)
    for (const wrong of ["0", "6", "4.5", "beş", "", " 5"]) {
      expect(starsOf({ puan: wrong })).toBeNull()
    }
    expect(starsOf({ puan: ["5", "4"] })).toBeNull()
  })

  it("keeps the filter on every page link, the page number after it", () => {
    expect(reviewsPath(1)).toBe("/yorumlar")
    expect(reviewsPath(3)).toBe("/yorumlar?sayfa=3")
    expect(reviewsPath(1, 5)).toBe("/yorumlar?puan=5")
    expect(reviewsPath(2, 4)).toBe("/yorumlar?puan=4&sayfa=2")
  })

  it("links each number of stars a review gave, counted shop-wide, the one shown marked", () => {
    const filter = reviewFilterView(summary, 4, t)

    expect(filter?.active).toBe(4)
    expect(filter?.activeLabel).toBe("4 yıldız")
    expect(filter?.clearPath).toBe("/yorumlar")
    expect(filter?.options.map((option) => [option.stars, option.count, option.path])).toEqual([
      [5, 24, "/yorumlar?puan=5"],
      [4, 5, "/yorumlar?puan=4"],
      [3, 1, "/yorumlar?puan=3"],
      [2, 0, null],
      [1, 0, null],
    ])
    expect(filter?.options.filter((option) => option.active).map((option) => option.stars)).toEqual(
      [4]
    )
    expect(filter?.options[0]?.label).toBe("Yalnız 5 yıldızlı değerlendirmeler (24)")
  })

  it("is none without the shop-wide spread, and has nothing active on the whole list", () => {
    expect(reviewFilterView(null, null, t)).toBeNull()
    expect(reviewFilterView({ ...summary, distribution: [] }, 5, t)).toBeNull()
    const whole = reviewFilterView(summary, null, t)
    expect(whole?.active).toBeNull()
    expect(whole?.activeLabel).toBeNull()
    expect(whole?.options.some((option) => option.active)).toBe(false)
  })
})
