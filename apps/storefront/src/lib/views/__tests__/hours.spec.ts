import { describe, expect, it } from "vitest"
import { t } from "@/lib/i18n"
import { hoursOf } from "../hours"

const range = (day: number, opens: string, closes: string) => ({ day, opens, closes })

describe("opening hours", () => {
  it("joins neighbouring days with the same hours and names a closed day", () => {
    const ranges = [1, 2, 3, 4, 5].map((day) => range(day, "08:00", "19:00"))
    expect(hoursOf([...ranges, range(6, "08:00", "16:00")], t)).toEqual([
      { days: "Pazartesi – Cuma", hours: "08:00 – 19:00" },
      { days: "Cumartesi", hours: "08:00 – 16:00" },
      { days: "Pazar", hours: "Kapalı" },
    ])
  })

  it("keeps a lunch break and does not join days apart from each other", () => {
    expect(
      hoursOf(
        [
          range(1, "09:00", "12:00"),
          range(1, "13:00", "18:00"),
          range(3, "09:00", "12:00"),
          range(3, "13:00", "18:00"),
        ],
        t
      )
    ).toEqual([
      { days: "Pazartesi", hours: "09:00 – 12:00, 13:00 – 18:00" },
      { days: "Salı", hours: "Kapalı" },
      { days: "Çarşamba", hours: "09:00 – 12:00, 13:00 – 18:00" },
      { days: "Perşembe – Pazar", hours: "Kapalı" },
    ])
  })

  it("says nothing when the shop gave no hours", () => {
    expect(hoursOf([], t)).toEqual([])
  })
})
