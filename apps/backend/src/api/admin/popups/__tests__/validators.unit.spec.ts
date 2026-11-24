import { StorePostPopupEvent } from "../../../store/popups/[id]/events/validators"
import { AdminPostPopup, AdminPostPopupStatus, AdminUpdatePopup } from "../validators"

const base = { name: "Kış indirimi", type: "info", title: "Kışa özel" }

const issue = (result: { success: boolean; error?: { issues: { message: string }[] } }) =>
  result.success ? null : (result.error?.issues[0]?.message ?? "")

describe("AdminPostPopup", () => {
  it("takes a pop-up with its name, type and title, trimmed", () => {
    const parsed = AdminPostPopup.parse({ ...base, name: "  Kış  ", title: " Kışa özel " })
    expect(parsed).toMatchObject({ name: "Kış", title: "Kışa özel" })
  })

  it("refuses unknown fields and an unknown type", () => {
    expect(AdminPostPopup.safeParse({ ...base, html: "<b>x</b>" }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ ...base, type: "exit" }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ type: "info", title: "x" }).success).toBe(false)
  })

  it("keeps the body's line breaks, refuses control characters and too many lines", () => {
    expect(AdminPostPopup.parse({ ...base, body: "Bir\r\nİki" }).body).toBe("Bir\nİki")
    expect(issue(AdminPostPopup.safeParse({ ...base, body: "a\u0007b" }))).toBe(
      "popups.text_invalid"
    )
    expect(issue(AdminPostPopup.safeParse({ ...base, body: "x\n".repeat(9) + "x" }))).toBe(
      "popups.text_invalid"
    )
    expect(issue(AdminPostPopup.safeParse({ ...base, body: "x".repeat(501) }))).toBe(
      "popups.text_invalid"
    )
    // A line break in a one-line field
    expect(issue(AdminPostPopup.safeParse({ ...base, title: "a\nb" }))).toBe("popups.text_invalid")
    // A bidi override reads one text as another
    expect(issue(AdminPostPopup.safeParse({ ...base, title: "a‮b" }))).toBe("popups.text_invalid")
  })

  it("takes text as text: markup is kept as typed, never read", () => {
    expect(AdminPostPopup.parse({ ...base, title: "<b>Kış</b>" }).title).toBe("<b>Kış</b>")
  })

  it("makes empty text null", () => {
    expect(AdminPostPopup.parse({ ...base, body: "  ", button_label: "" })).toMatchObject({
      body: null,
      button_label: null,
    })
  })

  it("takes a path on the shop or an https address as the link, nothing else", () => {
    expect(AdminPostPopup.parse({ ...base, button_href: "/kategori/kis" }).button_href).toBe(
      "/kategori/kis"
    )
    expect(AdminPostPopup.parse({ ...base, button_href: "https://ornek.com/a" }).button_href).toBe(
      "https://ornek.com/a"
    )
    for (const href of ["javascript:alert(1)", "//evil.example", "data:text/html,x"]) {
      expect(issue(AdminPostPopup.safeParse({ ...base, button_href: href }))).toBe(
        "popups.link_invalid"
      )
    }
  })

  it("bounds the numbers and the pages", () => {
    expect(AdminPostPopup.safeParse({ ...base, trigger_value: 121 }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ ...base, frequency_days: 0 }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ ...base, priority: -1 }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ ...base, pages: ["cart"] }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ ...base, pages: ["checkout"] }).success).toBe(false)
    expect(AdminPostPopup.safeParse({ ...base, pages: ["home", "product"] }).success).toBe(true)
  })

  it("reads dates with their offset", () => {
    const parsed = AdminPostPopup.parse({ ...base, starts_at: "2026-12-01T00:00:00+03:00" })
    expect(parsed.starts_at).toEqual(new Date("2026-11-30T21:00:00.000Z"))
    expect(AdminPostPopup.safeParse({ ...base, starts_at: "2026-12-01" }).success).toBe(false)
  })
})

describe("AdminUpdatePopup and the status switch", () => {
  it("takes any subset of the fields", () => {
    expect(AdminUpdatePopup.parse({ is_active: true })).toEqual({ is_active: true })
    expect(AdminUpdatePopup.safeParse({ title: "" }).success).toBe(false)
  })

  it("takes only the switch", () => {
    expect(AdminPostPopupStatus.safeParse({ is_active: true }).success).toBe(true)
    expect(AdminPostPopupStatus.safeParse({ is_active: "yes" }).success).toBe(false)
    expect(AdminPostPopupStatus.safeParse({ is_active: true, title: "x" }).success).toBe(false)
  })
})

describe("StorePostPopupEvent", () => {
  it("takes one of the four events and nothing else", () => {
    for (const type of ["impression", "click", "close", "signup"]) {
      expect(StorePostPopupEvent.safeParse({ type }).success).toBe(true)
    }
    expect(StorePostPopupEvent.safeParse({ type: "purchase" }).success).toBe(false)
    expect(StorePostPopupEvent.safeParse({ type: "click", email: "a@b.c" }).success).toBe(false)
  })
})
