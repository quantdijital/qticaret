import { describe, expect, it } from "vitest"
import {
  bodyOf,
  defaultsOf,
  draftOf,
  emptyableTokens,
  fieldsOf,
  groupMessages,
  isReworded,
  missingTokens,
  smsCount,
  unknownTokens,
  usesFreeText,
  valuesOf,
  withSamples,
} from "./customer-messages"
import {
  CONSENT,
  DELIVERED,
  MESSAGES,
  PAYMENT_LINK,
  PLACED,
  REMINDER,
} from "./customer-messages.fixtures"

/** adr/0036 Ek 2026-11-10: the customer messages' words as the panel edits them. */
describe("customer messages", () => {
  it("groups the list in the groups' order, leaving out a group with none", () => {
    const groups = groupMessages(MESSAGES)

    expect(groups.map((each) => each.group)).toEqual(["order", "shipping", "account", "marketing"])
    expect(groups[0]?.messages).toEqual([PLACED, PAYMENT_LINK])
    expect(isReworded(DELIVERED)).toBe(true)
    expect(isReworded(PLACED)).toBe(false)
  })

  it("starts from the shop's words, the platform's where it wrote none", () => {
    expect(valuesOf(DELIVERED)).toMatchObject({
      subject: "Teslim!",
      heading: "{müşteri_adı}, siparişiniz teslim edildi",
    })
    expect(defaultsOf(DELIVERED).subject).toBe("Siparişiniz teslim edildi (#{sipariş_no})")
  })

  it("sends only what changed, a default as null, the switch only where it is here", () => {
    const values = {
      ...valuesOf(DELIVERED),
      subject: "Siparişiniz teslim edildi (#{sipariş_no}) ",
      intro: "Merhaba {müşteri_adı}",
    }

    expect(bodyOf(DELIVERED, values, false)).toEqual({
      subject: null,
      intro: "Merhaba {müşteri_adı}",
      enabled: false,
    })
    expect(bodyOf(DELIVERED, valuesOf(DELIVERED), true)).toEqual({})
    expect(bodyOf(PLACED, valuesOf(PLACED), false)).toEqual({})
    expect(bodyOf(REMINDER, valuesOf(REMINDER), true)).toEqual({})
    expect(draftOf(DELIVERED, values)).toEqual({
      subject: null,
      preheader: null,
      heading: null,
      intro: "Merhaba {müşteri_adı}",
    })
  })

  it("names the tokens a message does not offer", () => {
    expect(unknownTokens("{müşteri_adı} {kargo_firması} {toplam}", DELIVERED)).toEqual([
      "kargo_firması",
      "toplam",
    ])
    expect(unknownTokens("{müşteri_adı} #{sipariş_no}", DELIVERED)).toEqual([])
  })

  it("counts the SMS with each token at its longest, Turkish letters in two septets", () => {
    expect(withSamples("{mağaza_adı}: #{sipariş_no}", PLACED)).toBe("Atölye: #1042")
    // "Atölye: #PL-9999999999" is 22 characters, each one septet (ö is in the GSM alphabet)
    expect(smsCount("{mağaza_adı}: #{sipariş_no}", PLACED)).toMatchObject({
      encoding: "gsm",
      units: 22,
      parts: 1,
    })
    // "Ayşe" in the preview, forty two-septet letters at most in a send
    expect(smsCount("{müşteri_adı} {müşteri_adı}", PLACED)).toMatchObject({
      units: 161,
      parts: 2,
    })
    expect(smsCount("ş".repeat(80), PLACED)).toMatchObject({ units: 160, parts: 2 })
    expect(smsCount("Merhaba 🙂", PLACED)).toMatchObject({ encoding: "ucs2", parts: 1 })
  })

  it("names the token a field must keep, those a send may leave empty, and typed ones", () => {
    expect(missingTokens("Ödeyin {toplam}", PAYMENT_LINK, "sms")).toEqual(["ödeme_bağlantısı"])
    expect(missingTokens("Ödeyin: {ödeme_bağlantısı}", PAYMENT_LINK, "sms")).toEqual([])
    expect(missingTokens("Hazır", PAYMENT_LINK, "subject")).toEqual([])
    expect(emptyableTokens("Takip: {takip_no}, {sipariş_no}", DELIVERED)).toEqual(["takip_no"])
    expect(usesFreeText("Merhaba {müşteri_adı}", PLACED)).toBe(true)
    expect(usesFreeText("#{sipariş_no}", PLACED)).toBe(false)
  })

  it("puts each field under its channel's tab", () => {
    expect(fieldsOf(PLACED, "email")).toEqual(["subject", "preheader", "heading", "intro"])
    expect(fieldsOf(PLACED, "sms")).toEqual(["sms"])
    expect(fieldsOf(DELIVERED, "sms")).toEqual([])
    expect(fieldsOf(CONSENT, "email")).toEqual([])
  })
})
