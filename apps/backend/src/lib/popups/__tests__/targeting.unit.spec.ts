import type { StorePopup } from "../store"
import { pickPopup, popupDue, popupMatches } from "../targeting"
import type { PopupViewContext } from "../targeting"

const NOW = new Date("2026-11-24T12:00:00.000Z")
const DAY = 24 * 60 * 60 * 1000

const popup = (id: string, values: Partial<StorePopup> = {}): StorePopup => ({
  id,
  type: "info",
  title: "Merhaba",
  body: null,
  image: null,
  button: null,
  submit_label: null,
  promotion: null,
  targeting: { pages: "all", device: "all", visitor: "any", membership: "any" },
  trigger: { kind: "delay", value: 5 },
  frequency: { kind: "session", days: null },
  layout: "modal",
  design: "classic",
  priority: 0,
  ends_at: null,
  ...values,
})

const context = (values: Partial<PopupViewContext> = {}): PopupViewContext => ({
  page: "home",
  device: "desktop",
  returning: false,
  member: false,
  now: NOW,
  session: new Set(),
  memory: {},
  ...values,
})

const targeting = (values: Partial<StorePopup["targeting"]>): Partial<StorePopup> => ({
  targeting: { pages: "all", device: "all", visitor: "any", membership: "any", ...values },
})

describe("popupMatches", () => {
  it("never stands on the cart, checkout, payment or account pages", () => {
    for (const page of ["cart", "checkout", "payment", "account"] as const) {
      expect(popupMatches(popup("a"), context({ page }))).toBe(false)
    }
    expect(popupMatches(popup("a"), context({ page: "other" }))).toBe(true)
  })

  it("keeps to the chosen pages", () => {
    const chosen = popup("a", targeting({ pages: ["product"] }))
    expect(popupMatches(chosen, context({ page: "product" }))).toBe(true)
    expect(popupMatches(chosen, context({ page: "home" }))).toBe(false)
    expect(popupMatches(chosen, context({ page: "other" }))).toBe(false)
  })

  it("keeps to the device, the visitor and the membership", () => {
    expect(popupMatches(popup("a", targeting({ device: "mobile" })), context())).toBe(false)
    expect(
      popupMatches(popup("a", targeting({ device: "mobile" })), context({ device: "mobile" }))
    ).toBe(true)
    expect(
      popupMatches(popup("a", targeting({ visitor: "new" })), context({ returning: true }))
    ).toBe(false)
    expect(popupMatches(popup("a", targeting({ visitor: "returning" })), context())).toBe(false)
    expect(popupMatches(popup("a", targeting({ membership: "member" })), context())).toBe(false)
    expect(
      popupMatches(popup("a", targeting({ membership: "guest" })), context({ member: true }))
    ).toBe(false)
  })

  it("stops at its end", () => {
    expect(popupMatches(popup("a", { ends_at: "2026-11-24T11:00:00.000Z" }), context())).toBe(false)
    expect(popupMatches(popup("a", { ends_at: "2026-11-24T13:00:00.000Z" }), context())).toBe(true)
  })
})

describe("popupDue", () => {
  it("shows at most once a session", () => {
    expect(popupDue(popup("a"), context({ session: new Set(["a"]) }))).toBe(false)
    expect(popupDue(popup("a"), context())).toBe(true)
  })

  it("waits the days since it was last shown", () => {
    const weekly = popup("a", { frequency: { kind: "days", days: 7 } })
    expect(
      popupDue(weekly, context({ memory: { a: { shown_at: NOW.getTime() - 6 * DAY } } }))
    ).toBe(false)
    expect(
      popupDue(weekly, context({ memory: { a: { shown_at: NOW.getTime() - 7 * DAY } } }))
    ).toBe(true)
  })

  it("stops for good once closed, when it is shown until closed", () => {
    const closing = popup("a", { frequency: { kind: "until_closed", days: null } })
    expect(popupDue(closing, context({ memory: { a: { shown_at: 1 } } }))).toBe(true)
    expect(popupDue(closing, context({ memory: { a: { dismissed: true } } }))).toBe(false)
  })
})

describe("pickPopup", () => {
  it("takes the first, in the backend's order, that matches and is due", () => {
    const list = [
      popup("mobile", targeting({ device: "mobile" })),
      popup("seen"),
      popup("fresh"),
      popup("later"),
    ]
    expect(pickPopup(list, context({ session: new Set(["seen"]) }))?.id).toBe("fresh")
    expect(pickPopup(list, context({ page: "checkout" }))).toBeNull()
    expect(pickPopup([], context())).toBeNull()
  })
})
