import {
  byPriority,
  earlierEnd,
  normalizePopup,
  popupProblem,
  popupState,
  promotionState,
} from "../eligibility"
import type { PopupPromotion, PopupValues } from "../eligibility"
import { POPUP_DEFAULTS } from "../rules"
import { storePopupOf } from "../store"

const NOW = new Date("2026-11-24T12:00:00.000Z")

const popup = (values: Partial<PopupValues> = {}): PopupValues => ({
  ...POPUP_DEFAULTS,
  pages: [],
  name: "Kış indirimi",
  type: "info",
  starts_at: null,
  ends_at: null,
  title: "Kışa özel",
  body: null,
  image_url: null,
  image_alt: null,
  button_label: null,
  button_href: null,
  promotion_id: null,
  ...values,
})

const promotion = (values: Partial<PopupPromotion> = {}): PopupPromotion => ({
  id: "promo_1",
  code: "KIS10",
  status: "active",
  is_automatic: false,
  limit: null,
  used: 0,
  campaign: null,
  ...values,
})

describe("popupProblem", () => {
  it("accepts a plain info pop-up", () => {
    expect(popupProblem(popup())).toBeNull()
  })

  it("asks a campaign pop-up for its promotion, and refuses one on the others", () => {
    expect(popupProblem(popup({ type: "campaign" }))?.key).toBe("popups.promotion_required")
    expect(popupProblem(popup({ type: "campaign", promotion_id: "promo_1" }))).toBeNull()
    expect(popupProblem(popup({ type: "info", promotion_id: "promo_1" }))?.key).toBe(
      "popups.promotion_not_allowed"
    )
    expect(popupProblem(popup({ type: "newsletter", promotion_id: "promo_1" }))?.field).toBe(
      "promotion_id"
    )
  })

  it("wants a button's words and link together, and no link on a newsletter", () => {
    expect(popupProblem(popup({ button_label: "İncele" }))?.key).toBe("popups.button_incomplete")
    expect(popupProblem(popup({ button_href: "/kategori/kis" }))?.key).toBe(
      "popups.button_incomplete"
    )
    expect(popupProblem(popup({ button_label: "İncele", button_href: "/kis" }))).toBeNull()
    expect(popupProblem(popup({ type: "newsletter", button_label: "Abone ol" }))).toBeNull()
    expect(popupProblem(popup({ type: "newsletter", button_href: "/x" }))?.key).toBe(
      "popups.button_link_not_allowed"
    )
  })

  it("wants a page when the pages are chosen", () => {
    expect(popupProblem(popup({ page_scope: "selected" }))?.key).toBe("popups.pages_required")
    expect(popupProblem(popup({ page_scope: "selected", pages: ["home"] }))).toBeNull()
  })

  it("bounds the trigger by its kind", () => {
    expect(popupProblem(popup({ trigger: "delay", trigger_value: 0 }))).toBeNull()
    expect(popupProblem(popup({ trigger: "delay", trigger_value: 121 }))?.key).toBe(
      "popups.trigger_value_invalid"
    )
    expect(popupProblem(popup({ trigger: "scroll", trigger_value: 0 }))?.key).toBe(
      "popups.trigger_value_invalid"
    )
    expect(popupProblem(popup({ trigger: "scroll", trigger_value: 100 }))).toBeNull()
  })

  it("wants the days of a every-few-days pop-up, and an end after the start", () => {
    expect(popupProblem(popup({ frequency: "days", frequency_days: null }))?.key).toBe(
      "popups.frequency_days_required"
    )
    expect(popupProblem(popup({ frequency: "session", frequency_days: null }))).toBeNull()
    expect(
      popupProblem(popup({ starts_at: "2026-12-01T00:00:00Z", ends_at: "2026-12-01T00:00:00Z" }))
        ?.key
    ).toBe("popups.dates_invalid")
    expect(
      popupProblem(popup({ starts_at: "2026-12-01T00:00:00Z", ends_at: "2026-12-02T00:00:00Z" }))
    ).toBeNull()
  })
})

describe("normalizePopup", () => {
  it("empties what a type or a choice does not use", () => {
    const kept = normalizePopup(
      popup({
        type: "newsletter",
        page_scope: "all",
        pages: ["home"],
        frequency: "session",
        frequency_days: 7,
        image_alt: "Kar",
        button_href: "/x",
      })
    )
    expect(kept).toMatchObject({
      pages: [],
      frequency_days: null,
      image_alt: null,
      button_href: null,
    })
  })

  it("keeps chosen pages once each", () => {
    const kept = normalizePopup(
      popup({ page_scope: "selected", pages: ["home", "home", "product"] })
    )
    expect(kept.pages).toEqual(["home", "product"])
  })
})

describe("promotionState", () => {
  it("is live only while active, started, not ended and not used up", () => {
    expect(promotionState(null, NOW)).toBe("missing")
    expect(promotionState(promotion(), NOW)).toBe("live")
    expect(promotionState(promotion({ status: "draft" }), NOW)).toBe("inactive")
    expect(promotionState(promotion({ status: "inactive" }), NOW)).toBe("inactive")
    expect(
      promotionState(
        promotion({ campaign: { starts_at: "2026-11-25T00:00:00Z", ends_at: null } }),
        NOW
      )
    ).toBe("not_started")
    expect(
      promotionState(
        promotion({ campaign: { starts_at: null, ends_at: "2026-11-24T12:00:00.000Z" } }),
        NOW
      )
    ).toBe("ended")
    expect(promotionState(promotion({ limit: 10, used: 10 }), NOW)).toBe("used_up")
    expect(promotionState(promotion({ limit: 10, used: 9 }), NOW)).toBe("live")
    // A code meant for one person is never live for a pop-up, even while active
    expect(promotionState(promotion({ linkable: false }), NOW)).toBe("inactive")
    expect(promotionState(promotion({ linkable: true }), NOW)).toBe("live")
  })
})

describe("popupState", () => {
  it("reads the switch, the dates and the campaign", () => {
    expect(popupState(popup(), null, NOW)).toBe("off")
    expect(popupState(popup({ is_active: true }), null, NOW)).toBe("live")
    expect(
      popupState(popup({ is_active: true, starts_at: "2026-11-25T00:00:00Z" }), null, NOW)
    ).toBe("scheduled")
    // An ended one says so even while switched off
    expect(popupState(popup({ ends_at: "2026-11-24T00:00:00Z" }), null, NOW)).toBe("ended")
    expect(popupState(popup({ is_active: true, type: "campaign" }), "ended", NOW)).toBe(
      "campaign_inactive"
    )
    expect(popupState(popup({ is_active: true, type: "campaign" }), "live", NOW)).toBe("live")
  })
})

describe("earlierEnd and byPriority", () => {
  it("takes the earlier of two ends, either open", () => {
    expect(earlierEnd(null, null)).toBeNull()
    expect(earlierEnd("2026-12-01T00:00:00.000Z", null)).toBe("2026-12-01T00:00:00.000Z")
    expect(earlierEnd("2026-12-05T00:00:00Z", "2026-12-01T00:00:00Z")).toBe(
      "2026-12-01T00:00:00.000Z"
    )
  })

  it("puts the higher priority first, then the newer", () => {
    const rows = [
      { id: "a", priority: 0, created_at: "2026-11-01T00:00:00Z" },
      { id: "b", priority: 5, created_at: "2026-11-01T00:00:00Z" },
      { id: "c", priority: 0, created_at: "2026-11-10T00:00:00Z" },
    ]
    expect(byPriority(rows).map((row) => row.id)).toEqual(["b", "c", "a"])
  })
})

describe("storePopupOf", () => {
  it("gives the storefront what it draws with, nothing of the panel's", () => {
    const store = storePopupOf(
      {
        ...popup({
          type: "campaign",
          is_active: true,
          promotion_id: "promo_1",
          button_label: "Alışverişe başla",
          button_href: "/kis",
          ends_at: "2026-12-31T00:00:00Z",
          page_scope: "selected",
          pages: ["home", "category"],
        }),
        id: "popup_1",
      },
      {
        image: null,
        promotion: promotion({ campaign: { starts_at: null, ends_at: "2026-12-15T00:00:00Z" } }),
      }
    )
    expect(store).toEqual({
      id: "popup_1",
      type: "campaign",
      title: "Kışa özel",
      body: null,
      image: null,
      button: { label: "Alışverişe başla", href: "/kis" },
      submit_label: null,
      promotion: { code: "KIS10", automatic: false },
      targeting: { pages: ["home", "category"], device: "all", visitor: "any", membership: "any" },
      trigger: { kind: "delay", value: 5 },
      frequency: { kind: "days", days: 7 },
      layout: "modal",
      priority: 0,
      ends_at: "2026-12-15T00:00:00.000Z",
    })
    expect(store).not.toHaveProperty("name")
    expect(store).not.toHaveProperty("promotion_id")
    expect(store).not.toHaveProperty("is_active")
  })

  it("shows no code for a promotion that applies on its own, and a newsletter's submit words", () => {
    const campaign = storePopupOf(
      { ...popup({ type: "campaign", promotion_id: "promo_1" }), id: "popup_1" },
      { image: null, promotion: promotion({ is_automatic: true }) }
    )
    expect(campaign.promotion).toEqual({ code: null, automatic: true })
    const newsletter = storePopupOf(
      { ...popup({ type: "newsletter", button_label: "Abone ol" }), id: "popup_2" },
      { image: null, promotion: null }
    )
    expect(newsletter.button).toBeNull()
    expect(newsletter.submit_label).toBe("Abone ol")
    expect(newsletter.promotion).toBeNull()
    expect(newsletter.targeting.pages).toBe("all")
  })
})
