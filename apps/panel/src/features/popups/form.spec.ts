import { describe, expect, it } from "vitest"
import { emptyValues, popupSchema, refusalField, requestOf, switchType, valuesOf } from "./form"
import type { PopupValues } from "./form"
import { popupFixture } from "./popups.fixtures"
import { dailyImpressions } from "./stats"

const valid = (overrides: Partial<PopupValues> = {}): PopupValues => ({
  ...emptyValues("info"),
  name: "Kargo duyurusu",
  title: "500 TL üzeri kargo bedava",
  ...overrides,
})

/** The error keys the schema gives, by field. */
function problems(values: PopupValues): Record<string, string> {
  const result = popupSchema.safeParse(values)
  if (result.success) {
    return {}
  }
  return Object.fromEntries(
    result.error.issues.map((issue) => [issue.path.join("."), issue.message])
  )
}

describe("popupSchema", () => {
  it("takes a new pop-up with only its name and title", () => {
    expect(problems(valid())).toEqual({})
  })

  it("asks for the name and the title", () => {
    expect(problems(valid({ name: " ", title: "" }))).toMatchObject({
      name: "popups.errors.nameRequired",
      title: "popups.errors.titleRequired",
    })
  })

  it("keeps the backend's text limits: 80 for the title, 500 and 8 lines for the body", () => {
    expect(problems(valid({ title: "a".repeat(81) }))).toMatchObject({
      title: "popups.errors.tooLong",
    })
    expect(problems(valid({ body: "a".repeat(501) }))).toMatchObject({
      body: "popups.errors.tooLong",
    })
    expect(problems(valid({ body: "a\n".repeat(9) + "a" }))).toMatchObject({
      body: "popups.errors.tooManyLines",
    })
    expect(problems(valid({ body: "a\n".repeat(7) + "a" }))).toEqual({})
    expect(problems(valid({ title: "Kargo‮bedava" }))).toMatchObject({
      title: "popups.errors.textInvalid",
    })
  })

  it("wants a campaign's promotion", () => {
    expect(problems(valid({ type: "campaign" }))).toMatchObject({
      promotion_id: "popups.errors.promotionRequired",
    })
    expect(problems(valid({ type: "campaign", promotion_id: "promo_1" }))).toEqual({})
  })

  it("wants a button's words and link together, and a path or an http(s) link", () => {
    expect(problems(valid({ button_label: "İncele" }))).toMatchObject({
      button_href: "popups.errors.buttonLinkRequired",
    })
    expect(problems(valid({ button_href: "/kampanya" }))).toMatchObject({
      button_label: "popups.errors.buttonLabelRequired",
    })
    expect(
      problems(valid({ button_label: "İncele", button_href: "javascript:alert(1)" }))
    ).toMatchObject({ button_href: "popups.errors.linkInvalid" })
    expect(problems(valid({ button_label: "İncele", button_href: "/kampanya" }))).toEqual({})
    // A newsletter's button sends the form: its words alone are enough
    expect(problems(valid({ type: "newsletter", button_label: "Kaydol" }))).toEqual({})
  })

  it("wants a page when the pages are chosen", () => {
    expect(problems(valid({ page_scope: "selected" }))).toMatchObject({
      pages: "popups.errors.pagesRequired",
    })
    expect(problems(valid({ page_scope: "selected", pages: ["home"] }))).toEqual({})
  })

  it("keeps the trigger within 0–120 seconds or 1–100 per cent", () => {
    expect(problems(valid({ trigger_value: 121 }))).toMatchObject({
      trigger_value: "popups.errors.delayRange",
    })
    expect(problems(valid({ trigger: "scroll", trigger_value: 0 }))).toMatchObject({
      trigger_value: "popups.errors.scrollRange",
    })
    expect(problems(valid({ trigger: "scroll", trigger_value: 100 }))).toEqual({})
    expect(problems(valid({ trigger_value: Number.NaN }))).toMatchObject({
      trigger_value: "popups.errors.number",
    })
  })

  it("asks for 1–365 days only while the frequency is in days", () => {
    expect(problems(valid({ frequency_days: 0 }))).toMatchObject({
      frequency_days: "popups.errors.daysRange",
    })
    expect(problems(valid({ frequency: "session", frequency_days: 0 }))).toEqual({})
  })

  it("wants the end after the start", () => {
    expect(
      problems(valid({ starts_at: "2026-12-10T10:00", ends_at: "2026-12-01T10:00" }))
    ).toMatchObject({ ends_at: "popups.errors.datesOrder" })
    expect(problems(valid({ starts_at: "2026-12-01T10:00", ends_at: "" }))).toEqual({})
  })
})

describe("switchType", () => {
  it("drops the promotion leaving a campaign and the link going to a newsletter", () => {
    const campaign = valid({
      type: "campaign",
      promotion_id: "promo_1",
      button_label: "Alışverişe başla",
      button_href: "/yeni",
    })
    expect(switchType(campaign, "newsletter")).toMatchObject({
      type: "newsletter",
      promotion_id: "",
      button_href: "",
      button_label: "Alışverişe başla",
    })
    expect(switchType(campaign, "campaign")).toMatchObject({ promotion_id: "promo_1" })
  })
})

describe("requestOf", () => {
  it("sends every field, a new one with its switch, the empty ones as null", () => {
    expect(requestOf(valid({ is_active: true }), { create: true })).toEqual({
      name: "Kargo duyurusu",
      type: "info",
      is_active: true,
      title: "500 TL üzeri kargo bedava",
      body: null,
      image_url: null,
      image_alt: null,
      button_label: null,
      button_href: null,
      promotion_id: null,
      page_scope: "all",
      pages: [],
      device: "all",
      visitor: "any",
      membership: "any",
      trigger: "delay",
      trigger_value: 5,
      frequency: "days",
      frequency_days: 7,
      layout: "modal",
      priority: 0,
      starts_at: null,
      ends_at: null,
    })
  })

  it("leaves the switch out of a saved one's save: the list's switch is its own", () => {
    expect(requestOf(valid({ is_active: true }), { create: false })).not.toHaveProperty("is_active")
  })

  it("sends null for what the type or a choice does not use", () => {
    const body = requestOf(
      valid({
        type: "newsletter",
        promotion_id: "promo_1",
        button_label: "Kaydol",
        button_href: "/eski",
        image_alt: "Bülten",
        page_scope: "all",
        pages: ["home"],
        frequency: "session",
        frequency_days: 7,
      }),
      { create: false }
    )
    expect(body).toMatchObject({
      promotion_id: null,
      button_label: "Kaydol",
      button_href: null,
      image_url: null,
      image_alt: null,
      pages: [],
      frequency_days: null,
    })
    expect(
      requestOf(valid({ type: "info", promotion_id: "promo_1" }), { create: false })
    ).toMatchObject({
      promotion_id: null,
    })
  })

  it("keeps a campaign's promotion, the chosen pages once each, the body's line breaks", () => {
    expect(
      requestOf(
        valid({
          type: "campaign",
          promotion_id: "promo_1",
          page_scope: "selected",
          pages: ["home", "product", "home"],
          body: "Bir\r\nİki ",
        }),
        { create: false }
      )
    ).toMatchObject({
      promotion_id: "promo_1",
      pages: ["home", "product"],
      body: "Bir\nİki",
    })
  })

  it("sends the dates with their offset", () => {
    const body = requestOf(valid({ starts_at: "2026-12-01T10:00" }), { create: false })
    expect(body.starts_at).toMatch(/^2026-12-01T10:00:00[+-]\d{2}:\d{2}$/)
    expect(body.ends_at).toBeNull()
  })
})

describe("valuesOf", () => {
  it("reads a saved pop-up into the form, null as empty", () => {
    const values = valuesOf(
      popupFixture({ type: "newsletter", frequency: "session", frequency_days: null })
    )
    expect(values).toMatchObject({
      type: "newsletter",
      body: "",
      button_label: "",
      frequency: "session",
      frequency_days: 7,
      starts_at: "",
    })
    expect(problems(values)).toEqual({})
  })
})

describe("refusalField", () => {
  it("puts a backend refusal under its field", () => {
    expect(refusalField({ code: "popups.promotion_unknown" })).toBe("promotion_id")
    expect(refusalField({ code: "popups.image_unknown" })).toBe("image_url")
    expect(refusalField({ code: "popups.text_invalid" })).toBeNull()
    expect(refusalField(new Error("x"))).toBeNull()
  })
})

describe("dailyImpressions", () => {
  it("fills the 30 days, a day with no count as 0", () => {
    const now = new Date("2026-11-24T12:00:00Z")
    const days = dailyImpressions(
      [
        { day: "2026-11-24", impressions: 12, clicks: 1, closes: 2, signups: 0 },
        { day: "2026-10-26", impressions: 3, clicks: 0, closes: 0, signups: 0 },
      ],
      now
    )
    expect(days).toHaveLength(30)
    expect(days[29]).toBe(12)
    expect(days[0]).toBe(3)
    expect(days.slice(1, 29).every((value) => value === 0)).toBe(true)
  })
})
