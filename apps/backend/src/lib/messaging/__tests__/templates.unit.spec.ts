import { MESSAGE_TEMPLATES } from "../templates"
import type { Brand, MessageTemplate } from "../templates"

const brand: Brand = {
  shopName: `Örnek <b>Mağaza</b>`,
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: "destek@magaza.example",
  contactPhone: "+905321234567",
  storefrontUrl: "https://magaza.example",
}

const templates = Object.values(MESSAGE_TEMPLATES) as MessageTemplate<unknown>[]

/** F9 KK1 (adr/0036): every message renders on each of its channels, from its own sample. */
describe.each(templates.map((template) => [template.name, template] as const))(
  "template %s",
  (_name, template) => {
    it("renders each channel it names, escaped, with a subject and a plain-text twin", () => {
      for (const channel of template.channels) {
        if (channel === "email") {
          const mail = template.email?.(template.sample, brand)
          expect(mail?.subject).toBeTruthy()
          expect(mail?.html).toContain("Örnek &lt;b&gt;Mağaza&lt;/b&gt;")
          expect(mail?.html).not.toContain("<b>Mağaza</b>")
          expect(mail?.text.length).toBeGreaterThan(20)
        } else {
          const sms = template.sms?.(template.sample, brand) ?? ""
          expect(sms.length).toBeGreaterThan(10)
          // One or two SMS parts in Turkish encoding
          expect(sms.length).toBeLessThanOrEqual(300)
        }
      }
    })

    it("says whether it needs consent: commercial ones say how to stop them", () => {
      if (template.kind === "commercial") {
        expect(template.email?.(template.sample, brand).text).toMatch(/izn/i)
        // An e-mail-only one (a cart reminder) has no text to say it in
        if (template.sms) {
          expect(template.sms(template.sample, brand)).toMatch(/Ret/)
        }
      }
      expect(["transactional", "commercial"]).toContain(template.kind)
    })
  }
)

describe("marketing.announcement SMS", () => {
  const sms = (title: string, body: string) =>
    MESSAGE_TEMPLATES["marketing.announcement"].sms?.({ title, body, url: null }, brand)

  it("runs the title into the body as a sentence of its own", () => {
    expect(sms("Yeni sezon", "Kargo bedava")).toBe(
      "Örnek <b>Mağaza</b>: Yeni sezon. Kargo bedava. Ret için mağazayla iletişime geçin."
    )
  })

  it("keeps the shop's own punctuation", () => {
    expect(sms("Son gün!", "Kaçırmayın…")).toContain(": Son gün! Kaçırmayın… Ret")
  })
})

describe("a commercial e-mail's way out", () => {
  const render = (unsubscribeUrl: string | null) =>
    MESSAGE_TEMPLATES["marketing.announcement"].email?.(
      { title: "Yeni sezon", body: "İndirim.", url: null },
      brand,
      { unsubscribeUrl }
    )

  it("links the recipient's unsubscribe page in the footer and the plain text", () => {
    const mail = render("https://api.magaza.example/unsubscribe?t=abc")
    expect(mail?.html).toContain('href="https://api.magaza.example/unsubscribe?t=abc"')
    expect(mail?.text).toContain(
      "Bu iletileri almak istemiyorum: https://api.magaza.example/unsubscribe?t=abc"
    )
  })

  it("draws no link without one, nor for an address that is no web link", () => {
    expect(render(null)?.html).not.toContain("almak istemiyorum")
    expect(render("javascript:alert(1)")?.html).not.toContain("javascript:")
  })
})

describe("staff.contact_message", () => {
  const mail = (vars: { subject: "order" | "kvkk"; due?: string | null }) =>
    MESSAGE_TEMPLATES["staff.contact_message"].email?.(vars, brand)

  it("names a KVKK request's legal last day (adr/0047 Ek 2026-11-02)", () => {
    const kvkk = mail({ subject: "kvkk", due: "2 Aralık 2026" })
    expect(kvkk?.subject).toBe("Yeni iletişim mesajı: KVKK başvurusu")
    expect(kvkk?.text).toContain("30 gün")
    expect(kvkk?.text).toContain("son gün 2 Aralık 2026")
    expect(kvkk?.html).toContain("2 Aralık 2026")
  })

  it("says nothing of a deadline for any other message", () => {
    expect(mail({ subject: "order" })?.text).not.toContain("30 gün")
  })
})
