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

describe("return.refused (adr/0032 Ek 2026-11-03)", () => {
  const template = MESSAGE_TEMPLATES["return.refused"]
  const refusedOnly = {
    ...template.sample,
    items: [{ title: "Bakım yağı", detail: null, quantity: 2 }],
    refused: [{ title: "Bakım yağı", detail: null, quantity: 2, reason: "unsealed" as const }],
    taken: false,
  }

  it("names each refused unit and why, that it is not paid back, and where the goods go", () => {
    const mail = template.email?.(refusedOnly, brand)

    expect(template.channels).toEqual(["email"])
    expect(mail?.subject).toBe("İadenizde kabul edilmeyen ürünler var (#1042)")
    expect(mail?.text).toContain("2 × Bakım yağı")
    expect(mail?.text).toContain("koruyucu ambalajı açılmış")
    expect(mail?.text).toContain("bedeli iade edilmez")
    expect(mail?.text).toContain("Ücreti mağazaya ait olmak üzere adresinize geri gönderilebilir")
    expect(mail?.text).toContain("mağazadan teslim alabilirsiniz")
    // Everything refused: no refund is coming, so none is promised
    expect(mail?.text).not.toContain("ayrıca iade edilecek")
  })

  it("says the rest goes on when other units were taken back, by the request's kind", () => {
    expect(template.email?.({ ...refusedOnly, taken: true }, brand).text).toContain(
      "diğer ürünlerin ödemesi ayrıca iade edilecek"
    )
    const swap = template.email?.({ ...refusedOnly, kind: "exchange", taken: true }, brand)
    expect(swap?.subject).toBe("Değişiminizde kabul edilmeyen ürünler var (#1042)")
    expect(swap?.text).toContain("değişim sürüyor")
  })

  it("leaves the refused units out of the refund's message, saying so only when there were any", () => {
    const refunded = MESSAGE_TEMPLATES["return.refunded"]
    const note = "Kabul edilmeyen ürünler (koruyucu ambalajı açılmış) bu tutara dahil değildir."

    expect(refunded.email?.(refunded.sample, brand).text).not.toContain(note)
    expect(
      refunded.email?.({ ...refunded.sample, refused: refusedOnly.refused, taken: true }, brand)
        .text
    ).toContain(note)
  })
})

describe("return.canceled (order #691)", () => {
  const template = MESSAGE_TEMPLATES["return.canceled"]

  it("says the request is off, nothing need be sent and a new one may be made, by kind", () => {
    const mail = template.email?.(template.sample, brand)
    expect(template.channels).toEqual(["email"])
    expect(mail?.subject).toBe("İade talebiniz iptal edildi (#1042)")
    expect(mail?.text).toContain("Örnek ürün")
    expect(mail?.text).toContain("geri göndermenize gerek yok")
    expect(mail?.text).toContain("kargo kodu artık geçerli değil")
    expect(mail?.text).toContain("yeni talep oluşturabilirsiniz")
    // The code given on approval is not repeated
    expect(mail?.text).not.toContain("GLV12345678")
    const swap = template.email?.({ ...template.sample, kind: "exchange" }, brand)
    expect(swap?.subject).toBe("Değişim talebiniz iptal edildi (#1042)")
  })
})

describe("the shop's payment trouble e-mail (review 2026-11-17)", () => {
  const template = MESSAGE_TEMPLATES["staff.payment_issue"]

  it("labels an order refund's order as the order, a payment's cart as the cart", () => {
    const refund = template.email?.(
      { ...template.sample, issue: "refund_unresolved", cart: "order_01ORNEK" },
      brand
    )
    const payment = template.email?.(template.sample, brand)

    expect(refund?.text).toContain("Sipariş")
    expect(refund?.text).not.toContain("Sepet")
    expect(payment?.text).toContain("Sepet")
  })
})
