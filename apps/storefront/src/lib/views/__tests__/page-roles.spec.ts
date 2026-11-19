import { describe, expect, it } from "vitest"
import { infoPageOf, isContactPage } from "../page-roles"

const page = (id: string, path: string) => ({ id, path })

describe("isContactPage (adr/0047, adr/0073 Açık kararlar 3)", () => {
  it("keeps the form on a page whose address changed: told by its id", () => {
    const frame = { contact_page_id: "cnt_contact", contact_form_path: "/bize-ulasin" }
    expect(isContactPage(page("cnt_contact", "/bize-ulasin"), frame)).toBe(true)
    // A draft the editor's session shows has no live address, still its role
    expect(
      isContactPage(page("cnt_contact", "/iletisim"), { ...frame, contact_form_path: null })
    ).toBe(true)
    expect(isContactPage(page("cnt_other", "/bize-ulasin"), frame)).toBe(false)
  })

  it("shows no form when the role has no page", () => {
    const frame = { contact_page_id: null, contact_form_path: null }
    expect(isContactPage(page("cnt_contact", "/iletisim"), frame)).toBe(false)
  })

  it("tells the page by its address from a backend before the ids", () => {
    expect(
      isContactPage(page("cnt_contact", "/iletisim"), { contact_form_path: "/iletisim" })
    ).toBe(true)
    expect(isContactPage(page("cnt_contact", "/destek"), { contact_form_path: "/iletisim" })).toBe(
      false
    )
  })
})

describe("infoPageOf (adr/0046 Ek 2026-11-05)", () => {
  it("knows the payment and shipping pages by their ids, whatever their addresses", () => {
    const frame = {
      payment_page_id: "cnt_pay",
      shipping_page_id: "cnt_ship",
      payment_info_path: "/taksitler",
      shipping_info_path: null,
    }
    expect(infoPageOf(page("cnt_pay", "/taksitler"), frame)).toBe("payments")
    expect(infoPageOf(page("cnt_ship", "/teslimat"), frame)).toBe("shipping")
    // The old fixed addresses are ordinary pages once the shop chose others
    expect(infoPageOf(page("cnt_x", "/odeme-secenekleri"), frame)).toBeNull()
  })

  it("names no page for a role without one", () => {
    const frame = { payment_page_id: null, shipping_page_id: null }
    expect(infoPageOf(page("cnt_x", "/odeme-secenekleri"), frame)).toBeNull()
    expect(infoPageOf(page("cnt_y", "/kargo-ve-teslimat"), frame)).toBeNull()
  })

  it("reads the pages by address from a backend before the ids", () => {
    const frame = { payment_info_path: "/taksit-secenekleri", shipping_info_path: "/teslimat" }
    expect(infoPageOf(page("cnt_x", "/taksit-secenekleri"), frame)).toBe("payments")
    expect(infoPageOf(page("cnt_y", "/teslimat"), frame)).toBe("shipping")
    expect(infoPageOf(page("cnt_z", "/kargo-ve-teslimat"), frame)).toBeNull()
    expect(
      infoPageOf(page("cnt_x", "/odeme-secenekleri"), {
        payment_info_path: null,
        shipping_info_path: null,
      })
    ).toBeNull()
  })

  it("keeps the usual addresses for a backend without the settings", () => {
    expect(infoPageOf(page("cnt_x", "/odeme-secenekleri"), {})).toBe("payments")
    expect(infoPageOf(page("cnt_y", "/kargo-ve-teslimat"), {})).toBe("shipping")
    expect(infoPageOf(page("cnt_z", "/hakkimizda"), {})).toBeNull()
  })
})
