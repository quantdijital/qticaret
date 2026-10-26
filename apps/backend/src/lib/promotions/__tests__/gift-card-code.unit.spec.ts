import { CODE_ALPHABET, giftCardCode, isGiftCardPrefix, normalizeCode } from ".."

describe("gift card codes (F4.8)", () => {
  it("draws sixteen characters on their own, in the plugin's form", () => {
    const code = giftCardCode()
    expect(code).toMatch(/^GIFT(-[23456789ABCDEFGHJKLMNPQRSTUVWXYZ]{4}){4}$/)
    expect(normalizeCode(code.toLowerCase())).toBe(code)
    // Each character its own draw
    let at = 0
    const counting = (max: number) => at++ % max
    const groups = CODE_ALPHABET.slice(0, 16).match(/.{4}/gu) ?? []
    expect(giftCardCode("YILBASI", counting)).toBe(`YILBASI-${groups.join("-")}`)
  })

  it("makes no two alike in many", () => {
    const codes = Array.from({ length: 2000 }, () => giftCardCode())
    expect(new Set(codes).size).toBe(2000)
  })

  it.each([
    ["YILBASI", true],
    ["KAMPANYA-2026", true],
    ["A", true],
    ["A".repeat(20), true],
    ["A".repeat(21), false],
    ["-YILBASI", false],
    ["YILBASI-", false],
    ["YIL BASI", false],
    ["", false],
  ])("takes %s as a shop's prefix: %s", (prefix, valid) => {
    expect(isGiftCardPrefix(prefix)).toBe(valid)
  })
})
