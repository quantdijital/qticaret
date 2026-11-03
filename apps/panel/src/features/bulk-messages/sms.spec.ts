import { describe, expect, it } from "vitest"
import { GREETING, composeSms, smsAsSent, smsFooter, smsLength } from "./sms"

describe("smsLength (the backend's count, adr/0050 §4)", () => {
  it("counts the GSM alphabet one each: 155 in one SMS, 149 a part after", () => {
    expect(smsLength("")).toMatchObject({ units: 0, parts: 0 })
    expect(smsLength("a".repeat(155))).toMatchObject({ encoding: "gsm", parts: 1, perPart: 155 })
    expect(smsLength("a".repeat(156))).toMatchObject({ parts: 2, perPart: 149 })
    expect(smsLength("a".repeat(447))).toMatchObject({ parts: 3 })
    expect(smsLength("a".repeat(448))).toMatchObject({ parts: 4 })
  })

  it("counts ş ğ ı İ ç and the extension characters twice, ü and ö once", () => {
    expect(smsLength("şğıİç").units).toBe(10)
    expect(smsLength("€{}").units).toBe(6)
    expect(smsLength("üöÜÖ").units).toBe(4)
  })

  it("sends a text with a character outside both tables as UCS-2: 70, then 67 a part", () => {
    expect(smsLength("Merhaba 🎉")).toMatchObject({ encoding: "ucs2", parts: 1, perPart: 70 })
    expect(smsLength("🎉".repeat(36))).toMatchObject({ encoding: "ucs2", units: 72, parts: 2 })
  })
})

describe("the text as it goes", () => {
  it("ends every text with the shop's name and the opt-out line, each a sentence", () => {
    expect(smsFooter("Bıçakçı", "Ret için RET yazın")).toBe("Bıçakçı. Ret için RET yazın")
    expect(composeSms("Kış indirimi başladı", "Bıçakçı", "RET")).toBe(
      "Kış indirimi başladı. Bıçakçı. RET"
    )
    expect(composeSms("Fırsat!", "Bıçakçı.", "")).toBe("Fırsat! Bıçakçı.")
  })

  it("fills the shop's details and puts the longest greeting for {ad}", () => {
    expect(
      smsAsSent("{ad}, {telefon} arayın", { telefon: "0532 000 00 00" }, "Bıçakçı", "RET")
    ).toBe(`${GREETING}, 0532 000 00 00 arayın. Bıçakçı. RET`)
  })
})
