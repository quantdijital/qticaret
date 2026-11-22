import { MESSAGE_TEMPLATES } from "../../templates"
import type { Brand } from "../../templates"
import type { ParcelVars } from "../../templates/shipping"
import { EDITABLE_TEMPLATES, editableTemplate } from "../registry"
import { defaultText, fillTemplateText, textsFor, unknownTemplateTokens } from "../texts"
import { TEXT_FIELDS } from "../types"

const brand: Brand = {
  shopName: "Atölye <b>",
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: "destek@magaza.example",
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

const shipped = MESSAGE_TEMPLATES["order.shipped"]

/** adr/0036 Ek 2026-11-10: the shop's words for its customer messages. */
describe("customer messages the shop may reword", () => {
  it("are the customer's, by group: never the team's alerts, a campaign or an announcement", () => {
    const names = EDITABLE_TEMPLATES.map((template) => template.name)

    expect(names.some((name) => name.startsWith("staff."))).toBe(false)
    expect(names).not.toContain("marketing.campaign")
    expect(names).not.toContain("marketing.announcement")
    expect(names).toContain("order.placed")
    expect(names).toContain("cart.reminder")
    expect(names.indexOf("order.placed")).toBeLessThan(names.indexOf("order.shipped"))
    expect(names.indexOf("order.shipped")).toBeLessThan(names.indexOf("return.requested"))
    expect(editableTemplate("staff.new_order")).toBeNull()
    expect(editableTemplate("constructor")).toBeNull()
  })

  it("keeps the legally and functionally required ones on", () => {
    const required = EDITABLE_TEMPLATES.filter((template) => template.editable.required)
      .map((template) => template.name)
      .sort()

    expect(required).toEqual([
      "account.password_reset",
      "account.verify_email",
      // adr/0076 Ek D7b: the booking's terms and voucher, and a cancel the shopper did not ask for
      "booking.cancelled",
      "booking.confirmed",
      "booking.departure_cancelled",
      "consent.confirm",
      "gift_card.issued",
      "order.access_link",
      "order.invoiced",
      "order.placed",
      "payment_link.sent",
      "return.approved",
      "return.refused",
      "stock.alert_confirm",
    ])
  })

  describe.each(EDITABLE_TEMPLATES.map((template) => [template.name, template] as const))(
    "%s",
    (_name, template) => {
      const spec = template.editable
      const fields = TEXT_FIELDS.filter((field) => spec.fields[field] !== undefined)

      it("shows every default in the shop's tokens: no catalog value is left unnamed", () => {
        for (const field of fields) {
          expect(defaultText(spec, field, template.sample)).not.toMatch(/\{\{/)
        }
      })

      it("reads the same when the shop sends its defaults back as its own words", () => {
        const own = Object.fromEntries(
          fields.map((field) => [field, defaultText(spec, field, template.sample)])
        )
        const platform = textsFor(spec, template.sample, brand, undefined)
        const shops = textsFor(spec, template.sample, brand, own)
        for (const field of fields) {
          expect(shops(field)).toBe(platform(field))
        }
      })

      it("offers only fields of its own channels", () => {
        if (spec.fields.sms !== undefined) {
          expect(template.channels).toContain("sms")
        }
      })
    }
  )
})

describe("the shop's own words", () => {
  it("names the tokens a template does not offer", () => {
    const allowed = Object.keys(shipped.editable?.tokens ?? {})

    expect(unknownTemplateTokens("{sipariş_no} {takip_no} {mağaza_adı}", allowed)).toEqual([])
    expect(unknownTemplateTokens("{siparis_no} ve {iban} {iban}", allowed)).toEqual([
      "siparis_no",
      "iban",
    ])
  })

  it("fills each token once: a value is never read as a token again", () => {
    expect(
      fillTemplateText("{müşteri_adı}: {sipariş_no}", {
        müşteri_adı: "{sipariş_no}\u202e",
        sipariş_no: "1042",
      })
    ).toBe("{sipariş_no}: 1042")
  })

  it("is used where written, the platform's text where not, and the layout escapes both", () => {
    const own = { subject: "Kargonuz yolda <script>", intro: "Merhaba {müşteri_adı},\nİyi günler" }
    const vars: ParcelVars = { ...shipped.sample, customerName: "<img src=x>" }

    const mail = shipped.email?.(vars, brand, { unsubscribeUrl: null, own })

    expect(mail?.subject).toBe("Kargonuz yolda <script>")
    expect(mail?.html).toContain("<title>Kargonuz yolda &lt;script&gt;</title>")
    expect(mail?.html).toContain("Merhaba &lt;img src=x&gt;,<br>İyi günler")
    expect(mail?.html).not.toContain("<img src=x>")
    expect(mail?.html).not.toContain("<script>")
    // The heading was not written: the platform's, with its value
    expect(mail?.html).toContain("&lt;img src=x&gt;, siparişiniz yolda")
    expect(mail?.text).toContain("Merhaba <img src=x>,\nİyi günler")
  })

  it("sends the shop's SMS with its tracking link, the platform's without one", () => {
    const own = { sms: "{mağaza_adı}: #{sipariş_no} {kargo_firması} ile yolda {takip_bağlantısı}" }

    expect(shipped.sms?.(shipped.sample, brand, own)).toBe(
      `Atölye <b>: #1042 Aras Kargo ile yolda ${shipped.sample.trackingUrl ?? ""}`
    )
    expect(shipped.sms?.(shipped.sample, brand)).toContain("Takip:")
  })

  it("says the return's kind in one text for both", () => {
    const template = editableTemplate("return.approved")
    const own = { subject: "{talep_türü} onaylandı #{sipariş_no}" }
    const sample = template?.sample as { kind: string }

    const exchange = template?.email?.({ ...sample, kind: "exchange" }, brand, {
      unsubscribeUrl: null,
      own,
    })

    expect(exchange?.subject).toBe("değişim onaylandı #1042")
  })
})

/** The security review's safety nets (adr/0036 Ek 2026-11-10). */
describe("a filled text that cannot go as it is", () => {
  const LINE_SEPARATOR = String.fromCharCode(0x2028)
  const PARAGRAPH_SEPARATOR = String.fromCharCode(0x2029)

  it("leaves no gap for an empty value, and drops line and paragraph separators", () => {
    expect(fillTemplateText("{gönderen_adı}  size   bir kart. Takip: {takip_no}", {})).toBe(
      "{gönderen_adı} size bir kart. Takip: {takip_no}"
    )
    expect(
      fillTemplateText("{gönderen_adı} size bir kart.\n Takip: {takip_no} ", {
        gönderen_adı: "",
        takip_no: "",
      })
    ).toBe("size bir kart.\nTakip:")
    expect(
      fillTemplateText("Merhaba {müşteri_adı}", {
        müşteri_adı: `Ay${LINE_SEPARATOR}şe${PARAGRAPH_SEPARATOR}`,
      })
    ).toBe("Merhaba Ayşe")
  })

  it("puts the platform's words in a one-line field that came out empty", () => {
    const gift = editableTemplate("gift_card.issued")
    const sample = gift?.sample as { senderName: string | null }

    const mail = gift?.email?.({ ...sample, senderName: null }, brand, {
      unsubscribeUrl: null,
      own: { subject: "{gönderen_adı}", heading: "  {gönderen_adı}  " },
    })

    expect(mail?.subject).toBe("Atölye <b> hediye kartınız")
    expect(mail?.text).toContain("Zeynep, size bir hediye kartı var")
  })

  it("sends the platform's SMS when a stored one lacks its link or runs past three parts", () => {
    const link = MESSAGE_TEMPLATES["payment_link.sent"]

    const without = link.sms?.(link.sample, brand, { sms: "Ödeyin: {toplam}" })
    const long = shipped.sms?.(shipped.sample, brand, { sms: "ş".repeat(250) })

    expect(without).toContain(link.sample.url)
    expect(without).not.toBe("Ödeyin: ₺449,90")
    expect(long).toBe(shipped.sms?.(shipped.sample, brand))
  })
})
