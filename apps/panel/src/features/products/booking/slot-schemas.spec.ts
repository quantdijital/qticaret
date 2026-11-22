import { describe, expect, it } from "vitest"
import { i18next } from "@/lib/i18n"
import { bookingFailureText } from "./booking-failure"
import {
  adjustmentsOf,
  settingsDraftOf,
  settingsInputOf,
  settingsSchema,
  signedMoney,
} from "./slot-schemas"

describe("booking drafts", () => {
  it("reads a difference with its sign and drops empty and zero ones", () => {
    expect(signedMoney("-150,50")).toBe(-150.5)
    expect(signedMoney("1.250")).toBe(1250)
    expect(signedMoney("abc")).toBeNull()
    expect(adjustmentsOf({ capacity: "5", adjustments: { a: "250,50", b: "", c: "0" } })).toEqual({
      a: 250.5,
    })
    expect(adjustmentsOf({ capacity: "5", adjustments: { a: "" } })).toBeNull()
  })

  it("starts from the server's defaults and sends only variants that differ from one place", () => {
    const draft = settingsDraftOf(null, [{ id: "adult" }, { id: "infant" }])
    expect(draft).toMatchObject({ hold_minutes: "20", cutoff_hours: "0", min_participants: "" })
    const input = settingsInputOf({
      ...draft,
      pax: {
        adult: { pax: "1", min_age: "", max_age: "" },
        infant: { pax: "0", min_age: "", max_age: "2" },
      },
    })
    expect(input).toEqual({
      cutoff_hours: 0,
      hold_minutes: 20,
      max_units_per_cart: 20,
      min_participants: null,
      pax_by_variant: { infant: { pax: 0, max_age: 2 } },
    })
  })

  it("refuses a hold outside 10–60 minutes and ages the wrong way round", () => {
    const draft = settingsDraftOf(null, [{ id: "child" }])
    expect(settingsSchema.safeParse({ ...draft, hold_minutes: "5" }).success).toBe(false)
    const ages = settingsSchema.safeParse({
      ...draft,
      pax: { child: { pax: "1", min_age: "12", max_age: "6" } },
    })
    expect(ages.error?.issues[0]?.message).toBe("products.booking.errors.paxAges")
  })

  it("words the server's capacity refusal in both languages", () => {
    const failure = { status: 400, message: "booking.capacity_below_sold" }
    expect(bookingFailureText(i18next.getFixedT("tr"), failure)).toBe(
      "Kontenjan, satılan ve sepetlerde tutulan yer sayısının altına indirilemez."
    )
    expect(bookingFailureText(i18next.getFixedT("en"), failure)).toBe(
      "Capacity cannot go below the places sold and held in carts."
    )
  })
})
