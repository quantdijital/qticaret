import { isValidationError } from "../../../errors"
import type { Brand, MessageTemplate } from "../../templates"
import { checkOwnTexts, ownTextsOf } from "../check"
import type { CheckedTexts, TextsInput } from "../check"
import { editableTemplate } from "../registry"

const brand: Brand = {
  shopName: "Atölye",
  logoUrl: null,
  color: "#2f6feb",
  contactEmail: null,
  contactPhone: null,
  storefrontUrl: "https://magaza.example",
}

const template = (name: string): MessageTemplate<unknown> => {
  const found = editableTemplate(name)
  if (!found) {
    throw new Error(`no template ${name}`)
  }
  return found
}

const check = (name: string, input: TextsInput, current: CheckedTexts | null = null) =>
  checkOwnTexts(template(name), input, current, template(name).sample, brand)

/** The refusal's key, field and values; fails the test when nothing is refused. */
function refusal(run: () => unknown) {
  try {
    run()
  } catch (error) {
    if (isValidationError(error)) {
      return { key: error.safeMessage, field: error.field, values: error.values }
    }
    throw error
  }
  throw new Error("expected a refusal")
}

/** adr/0036 Ek 2026-11-10: a shop's words checked before they are kept. */
describe("checkOwnTexts", () => {
  it("keeps plain words, trimmed, and nothing for a field sent back as the default", () => {
    const checked = check("order.shipped", {
      subject: "  Kargonuz yolda, {müşteri_adı}  ",
      heading: "{müşteri_adı}, siparişiniz yolda",
      intro: "Merhaba\r\n\r\n{sipariş_no} yolda.",
      sms: null,
    })

    expect(checked).toEqual({
      enabled: true,
      subject: "Kargonuz yolda, {müşteri_adı}",
      preheader: null,
      heading: null,
      intro: "Merhaba\n\n{sipariş_no} yolda.",
      sms: null,
    })
    expect(ownTextsOf(checked)).toEqual({
      subject: "Kargonuz yolda, {müşteri_adı}",
      intro: "Merhaba\n\n{sipariş_no} yolda.",
    })
  })

  it("keeps what is not sent, and turns an optional message off", () => {
    const current: CheckedTexts = { ...check("order.delivered", {}), subject: "Teslim edildi" }

    const checked = check("order.delivered", { enabled: false }, current)

    expect(checked).toMatchObject({ enabled: false, subject: "Teslim edildi" })
  })

  it("refuses an unknown token, naming it and the ones offered", () => {
    expect(
      refusal(() => check("order.delivered", { intro: "{takip_no} {sipariş_no} {iban}" }))
    ).toEqual({
      key: "messaging.template_token_unknown",
      field: "intro",
      values: {
        tokens: "{takip_no}, {iban}",
        available: "{mağaza_adı}, {müşteri_adı}, {sipariş_no}",
      },
    })
  })

  it("never turns a required message off", () => {
    for (const name of ["order.placed", "account.password_reset", "return.approved"]) {
      expect(refusal(() => check(name, { enabled: false })).key).toBe("messaging.template_required")
      expect(check(name, { enabled: true }).enabled).toBe(true)
    }
    // A stored "off" on a required one changes nothing
    const stored = { ...check("order.placed", {}), enabled: false }
    expect(check("order.placed", { subject: "Teşekkürler" }, stored).enabled).toBe(true)
  })

  it("leaves the cart reminder's switch to its own feature", () => {
    expect(refusal(() => check("cart.reminder", { enabled: false })).key).toBe(
      "messaging.template_switched_elsewhere"
    )
  })

  it("refuses a field the message does not have", () => {
    expect(refusal(() => check("order.delivered", { sms: "Teslim edildi" }))).toMatchObject({
      key: "messaging.template_field_unknown",
      field: "sms",
    })
    expect(refusal(() => check("consent.confirm", { subject: "Onay" })).key).toBe(
      "messaging.template_field_unknown"
    )
  })

  it("refuses a line break in a one-line field, hidden characters and a long text", () => {
    expect(refusal(() => check("order.delivered", { subject: "a\nb" }))).toMatchObject({
      key: "messaging.template_text_invalid",
      field: "subject",
    })
    expect(refusal(() => check("order.delivered", { intro: "abc\u202edef" })).key).toBe(
      "messaging.template_text_invalid"
    )
    expect(refusal(() => check("order.delivered", { intro: "a\tb" })).key).toBe(
      "messaging.template_text_invalid"
    )
    expect(refusal(() => check("order.delivered", { subject: "x".repeat(151) }))).toMatchObject({
      key: "messaging.template_text_too_long",
      values: { limit: "150" },
    })
    // An emoji with its joiner is no hidden character
    expect(check("order.delivered", { subject: "Teslim \u{1F469}\u200d\u{1F467}" }).subject).toBe(
      "Teslim \u{1F469}\u200d\u{1F467}"
    )
  })

  it("refuses an SMS past three parts with the sample's values", () => {
    expect(refusal(() => check("order.placed", { sms: "ş".repeat(300) }))).toMatchObject({
      key: "messaging.sms_too_long",
      field: "sms",
    })
    expect(check("order.placed", { sms: "{mağaza_adı}: #{sipariş_no} alındı" }).sms).toBe(
      "{mağaza_adı}: #{sipariş_no} alındı"
    )
  })

  it("counts the SMS with each token at its longest, not the sample's short values", () => {
    // Five names: "Ayşe" in the preview, forty two-septet letters at most in a send
    const names = "{müşteri_adı} ".repeat(5)

    expect(refusal(() => check("order.shipped", { sms: `${names}{takip_bağlantısı}` })).key).toBe(
      "messaging.sms_too_long"
    )
    expect(check("order.shipped", { sms: `{müşteri_adı} {takip_bağlantısı}` }).sms).toBe(
      "{müşteri_adı} {takip_bağlantısı}"
    )
  })

  it("refuses a required message's SMS without the link only it carries, naming it", () => {
    expect(
      refusal(() =>
        check("payment_link.sent", { sms: "{mağaza_adı}: siparişiniz hazır, {toplam}" })
      )
    ).toEqual({
      key: "messaging.template_token_missing",
      field: "sms",
      values: { tokens: "{ödeme_bağlantısı}" },
    })
    expect(check("payment_link.sent", { sms: "Ödeyin: {ödeme_bağlantısı}" }).sms).toBe(
      "Ödeyin: {ödeme_bağlantısı}"
    )
    // The e-mail keeps its fixed button: its words may leave the link out
    expect(check("payment_link.sent", { intro: "Siparişiniz hazır." }).intro).toBe(
      "Siparişiniz hazır."
    )
  })
})
