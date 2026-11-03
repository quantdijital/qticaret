import { previewVars } from "../preview"
import type { PreviewFacts } from "../preview"
import { MESSAGE_TEMPLATES } from "../templates"
import type { MessageTemplate } from "../templates"

const empty: PreviewFacts = {
  shopName: "Atölye Bıçak",
  storefrontUrl: null,
  panelUrl: "http://localhost:5173",
  legal: { company_title: null, mersis: null },
  smsOptOut: null,
  bank: { holder: "", bank: "", iban: "", deadline: null },
}

const filled: PreviewFacts = {
  ...empty,
  storefrontUrl: "https://atolye.com.tr",
  legal: { company_title: "Atölye Ticaret A.Ş.", mersis: "0987654321000017" },
  smsOptOut: "Ret için RET yazıp 4600'e gönderin.",
  bank: {
    holder: "Atölye Ticaret A.Ş.",
    bank: "Ziraat Bankası",
    iban: "TR330006100519786457841326",
    deadline: "5 Kasım 2026 14:30",
  },
}

const templates = Object.values(MESSAGE_TEMPLATES) as MessageTemplate<unknown>[]

describe("a message's preview (F9.3)", () => {
  it("shows the shop's bank account for a transfer, and a made-up one only where it is blank", () => {
    const order = MESSAGE_TEMPLATES["order.placed"]

    expect(previewVars(order, filled).bank).toEqual({
      holder: "Atölye Ticaret A.Ş.",
      bank: "Ziraat Bankası",
      iban: "TR33 0006 1005 1978 6457 8413 26",
      deadline: "5 Kasım 2026 14:30",
    })
    expect(previewVars(order, { ...filled, bank: { ...empty.bank, deadline: null } }).bank).toEqual(
      order.sample.bank
    )
    expect(previewVars(order, { ...filled, bank: { ...filled.bank, bank: "" } }).bank?.bank).toBe(
      "Örnek Bank"
    )
  })

  it("ends a bulk message with the shop's title, MERSİS, name and way to refuse", () => {
    const campaign = previewVars(MESSAGE_TEMPLATES["marketing.campaign"], filled)

    expect(campaign.legal).toBe("Atölye Ticaret A.Ş. · MERSİS 0987654321000017")
    expect(campaign.sms).toBe(
      "Hafta sonuna özel %20 indirim! Atölye Bıçak. Ret için RET yazıp 4600'e gönderin."
    )
  })

  it("keeps the made-up title, MERSİS and way to refuse while the shop has not set them", () => {
    const campaign = previewVars(MESSAGE_TEMPLATES["marketing.campaign"], {
      ...empty,
      legal: { company_title: "Atölye Ticaret A.Ş.", mersis: null },
    })

    expect(campaign.legal).toBe("Atölye Ticaret A.Ş. · MERSİS 0123456789000015")
    expect(campaign.sms).toBe(
      "Hafta sonuna özel %20 indirim! Atölye Bıçak. Ret için ORNEK yazıp 0000'e gönderin."
    )
  })

  it("links a shopper's message to the storefront and a staff member's to the panel", () => {
    expect(previewVars(MESSAGE_TEMPLATES["cart.reminder"], filled).cartUrl).toBe(
      "https://atolye.com.tr/sepet/geri-don?token=ornek"
    )
    expect(previewVars(MESSAGE_TEMPLATES["gift_card.issued"], filled).shopUrl).toBe(
      "https://atolye.com.tr"
    )
    expect(previewVars(MESSAGE_TEMPLATES["staff.invite"], filled).inviteUrl).toBe(
      "http://localhost:5173/invite#token=ornek"
    )
    // No storefront yet: the made-up address stays, the panel's is always known
    expect(previewVars(MESSAGE_TEMPLATES["cart.reminder"], empty).cartUrl).toBe(
      MESSAGE_TEMPLATES["cart.reminder"].sample.cartUrl
    )
    expect(previewVars(MESSAGE_TEMPLATES["staff.password_reset"], empty).resetUrl).toBe(
      "http://localhost:5173/reset-password#token=ornek"
    )
  })

  it.each(templates.map((template) => [template.name, template] as const))(
    "%s: no made-up address or identity once the shop has filled its details",
    (_name, template) => {
      const shown = JSON.stringify(previewVars(template, filled))

      expect(shown).not.toContain("magaza.example")
      expect(shown).not.toContain("Örnek Bank")
      expect(shown).not.toContain("0123456789000015")
      expect(shown).not.toContain("ORNEK yazıp")
      // The sample itself is never changed
      expect(JSON.stringify(template.sample)).toBe(JSON.stringify(template.sample))
    }
  )
})
