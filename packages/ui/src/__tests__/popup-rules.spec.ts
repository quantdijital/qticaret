import { describe, expect, it } from "vitest"
import type { PopupView } from "../popup-views"
import type { PopupViewContext } from "../lib/popup-rules"
import {
  POPUP_BLOCKED_PAGES,
  blockedPageOf,
  pickPopup,
  popupDue,
  popupMatches,
  scrolledPast,
} from "../lib/popup-rules"

/** The same cases as the backend's reference (`apps/backend/src/lib/popups/__tests__`). */

const NOW = new Date("2026-11-24T12:00:00Z")
const DAY = 24 * 60 * 60 * 1000

const popup = (patch: Partial<PopupView> = {}): PopupView => ({
  id: "popup_1",
  type: "info",
  title: "Kış indirimi başladı",
  body: null,
  image: null,
  button: null,
  submitLabel: null,
  promotion: null,
  targeting: { pages: "all", device: "all", visitor: "any", membership: "any" },
  trigger: { kind: "delay", value: 5 },
  frequency: { kind: "session", days: null },
  layout: "modal",
  design: "classic",
  priority: 0,
  endsAt: null,
  ...patch,
})

const context = (patch: Partial<PopupViewContext> = {}): PopupViewContext => ({
  page: "home",
  device: "desktop",
  returning: false,
  member: false,
  now: NOW,
  session: new Set(),
  memory: {},
  ...patch,
})

const targeting = (patch: Partial<PopupView["targeting"]>): Partial<PopupView> => ({
  targeting: { ...popup().targeting, ...patch },
})

describe("popupMatches: page, screen, visitor", () => {
  it("never stands on the cart, the checkout, the payment or the account, whatever it says", () => {
    for (const page of POPUP_BLOCKED_PAGES) {
      expect(popupMatches(popup(), context({ page }))).toBe(false)
    }
    expect(POPUP_BLOCKED_PAGES).toEqual(["cart", "checkout", "payment", "account"])
  })

  it("takes every other page under all, the chosen ones only under a list", () => {
    expect(popupMatches(popup(), context({ page: "other" }))).toBe(true)
    const chosen = popup(targeting({ pages: ["product", "category"] }))
    expect(popupMatches(chosen, context({ page: "product" }))).toBe(true)
    expect(popupMatches(chosen, context({ page: "home" }))).toBe(false)
    expect(popupMatches(chosen, context({ page: "other" }))).toBe(false)
  })

  it("follows the device", () => {
    const phone = popup(targeting({ device: "mobile" }))
    expect(popupMatches(phone, context({ device: "mobile" }))).toBe(true)
    expect(popupMatches(phone, context({ device: "desktop" }))).toBe(false)
  })

  it("tells a new visitor from a returning one", () => {
    const fresh = popup(targeting({ visitor: "new" }))
    const back = popup(targeting({ visitor: "returning" }))
    expect(popupMatches(fresh, context({ returning: false }))).toBe(true)
    expect(popupMatches(fresh, context({ returning: true }))).toBe(false)
    expect(popupMatches(back, context({ returning: true }))).toBe(true)
    expect(popupMatches(back, context({ returning: false }))).toBe(false)
  })

  it("tells a member from a guest", () => {
    const members = popup(targeting({ membership: "member" }))
    const guests = popup(targeting({ membership: "guest" }))
    expect(popupMatches(members, context({ member: true }))).toBe(true)
    expect(popupMatches(members, context({ member: false }))).toBe(false)
    expect(popupMatches(guests, context({ member: false }))).toBe(true)
    expect(popupMatches(guests, context({ member: true }))).toBe(false)
  })

  it("hides once its end has passed, and an end it cannot read", () => {
    expect(popupMatches(popup({ endsAt: "2026-11-24T13:00:00Z" }), context())).toBe(true)
    expect(popupMatches(popup({ endsAt: "2026-11-24T12:00:00Z" }), context())).toBe(false)
    expect(popupMatches(popup({ endsAt: "2026-11-23T12:00:00Z" }), context())).toBe(false)
    expect(popupMatches(popup({ endsAt: "yarın" }), context())).toBe(false)
  })
})

describe("popupDue: frequency", () => {
  it("shows once a session, whatever the frequency", () => {
    for (const kind of ["session", "days", "until_closed"] as const) {
      const each = popup({ frequency: { kind, days: kind === "days" ? 7 : null } })
      expect(popupDue(each, context())).toBe(true)
      expect(popupDue(each, context({ session: new Set(["popup_1"]) }))).toBe(false)
    }
  })

  it("comes back every session until closed, then never", () => {
    const each = popup({ frequency: { kind: "until_closed", days: null } })
    expect(popupDue(each, context({ memory: { popup_1: { shown_at: NOW.getTime() } } }))).toBe(true)
    expect(popupDue(each, context({ memory: { popup_1: { dismissed: true } } }))).toBe(false)
  })

  it("waits its days since the last showing", () => {
    const each = popup({ frequency: { kind: "days", days: 7 } })
    const shown = (ago: number) =>
      context({ memory: { popup_1: { shown_at: NOW.getTime() - ago } } })
    expect(popupDue(each, shown(6 * DAY))).toBe(false)
    expect(popupDue(each, shown(7 * DAY))).toBe(true)
    // Closed does not matter to days: it comes back after them
    expect(
      popupDue(
        each,
        context({ memory: { popup_1: { shown_at: NOW.getTime() - 8 * DAY, dismissed: true } } })
      )
    ).toBe(true)
  })

  it("reads days null as one day", () => {
    const each = popup({ frequency: { kind: "days", days: null } })
    expect(
      popupDue(each, context({ memory: { popup_1: { shown_at: NOW.getTime() - DAY + 1 } } }))
    ).toBe(false)
    expect(
      popupDue(each, context({ memory: { popup_1: { shown_at: NOW.getTime() - DAY } } }))
    ).toBe(true)
  })
})

describe("pickPopup: one a page view", () => {
  it("takes the first, in the backend's order, that matches and is due", () => {
    const first = popup({ id: "popup_a", priority: 10, ...targeting({ device: "mobile" }) })
    const second = popup({ id: "popup_b", priority: 5 })
    const third = popup({ id: "popup_c", priority: 1 })
    expect(pickPopup([first, second, third], context())?.id).toBe("popup_b")
    expect(pickPopup([first, second, third], context({ session: new Set(["popup_b"]) }))?.id).toBe(
      "popup_c"
    )
  })

  it("takes none when none fits", () => {
    expect(pickPopup([], context())).toBeNull()
    expect(pickPopup([popup()], context({ page: "cart" }))).toBeNull()
  })
})

describe("blockedPageOf: the paying and the account pages by their address", () => {
  it("knows the cart, the checkout, a payment link, the account and an order", () => {
    expect(blockedPageOf("/sepet")).toBe("cart")
    expect(blockedPageOf("/sepet/geri-don")).toBe("cart")
    expect(blockedPageOf("/odeme")).toBe("checkout")
    expect(blockedPageOf("/odeme/sonuc/hata")).toBe("checkout")
    expect(blockedPageOf("/ode/abc123")).toBe("payment")
    expect(blockedPageOf("/hesap/siparisler")).toBe("account")
    expect(blockedPageOf("/siparis/order_1")).toBe("account")
  })

  it("leaves every other address, even one that only starts alike", () => {
    expect(blockedPageOf("/")).toBeNull()
    expect(blockedPageOf("/sepetler")).toBeNull()
    expect(blockedPageOf("/odemeler-hakkinda")).toBeNull()
    expect(blockedPageOf("/kategoriler")).toBeNull()
  })
})

describe("scrolledPast", () => {
  it("measures the bottom of the screen against the page", () => {
    const page = (scrollY: number) => ({ scrollY, viewport: 800, height: 2800 })
    expect(scrolledPast(50, page(999))).toBe(false)
    expect(scrolledPast(50, page(1000))).toBe(true)
    expect(scrolledPast(100, page(2000))).toBe(true)
  })

  it("counts a page shorter than the screen as seen whole", () => {
    expect(scrolledPast(80, { scrollY: 0, viewport: 900, height: 600 })).toBe(true)
  })
})
