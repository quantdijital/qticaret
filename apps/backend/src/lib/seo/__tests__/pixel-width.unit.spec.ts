import { SERP_LIMITS, estimatePixelWidth, fitsSerp } from "../pixel-width"

describe("estimatePixelWidth", () => {
  it("adds advance widths scaled to the font size", () => {
    // a, b: 556 each; i: 222 (per 1000 em) at 10 px
    expect(estimatePixelWidth("abi", 10)).toBeCloseTo(13.34, 2)
  })

  it("measures Turkish letters by their base letter", () => {
    // Dotless ı is 278 wide, more than dotted i (222)
    expect(estimatePixelWidth("şğüöçı", 20)).toBeCloseTo(
      estimatePixelWidth("sguoci", 20) + (278 - 222) * 0.02,
      6
    )
    expect(estimatePixelWidth("ĞŞ", 20)).toBe(estimatePixelWidth("GS", 20))
  })

  it("treats wide capitals as wider than the same count of narrow letters", () => {
    expect(estimatePixelWidth("WWWW", 20)).toBeGreaterThan(estimatePixelWidth("iiii", 20) * 4)
  })

  it("measures other accented letters by their base and unknown ones as average", () => {
    expect(estimatePixelWidth("é", 10)).toBe(estimatePixelWidth("e", 10))
    expect(estimatePixelWidth("ж", 10)).toBeCloseTo(5.56, 2)
  })

  it("counts emoji and CJK as a full em", () => {
    expect(estimatePixelWidth("🔪", 10)).toBe(10)
    expect(estimatePixelWidth("刀", 10)).toBe(10)
  })

  it.each([
    ["W", 944],
    ["@", 1015],
    ["ı", 278],
    ["İ", 278],
    ["i", 222],
    ["Ş", 667],
    ["—", 1000],
  ])("pins the AFM width of %s", (char, width) => {
    expect(estimatePixelWidth(char, 1000)).toBe(width)
  })

  it("counts marks, joiners and variation selectors as nothing, no-break spaces as spaces", () => {
    expect(estimatePixelWidth("e\u0301", 1000)).toBe(556)
    expect(estimatePixelWidth("\u2764\uFE0F", 1000)).toBe(1000)
    expect(estimatePixelWidth("a\u200Db\u00AD", 1000)).toBe(1112)
    expect(estimatePixelWidth("\u00A0", 1000)).toBe(278)
  })

  it("covers every printable ASCII character with its own width", () => {
    const printable = Array.from({ length: 95 }, (_, index) => String.fromCharCode(32 + index))
    const unknown = printable.filter((char) => {
      const width = estimatePixelWidth(char, 1000)
      return width === 556 && !/[#$0-9?L_abdeghnopqu]/.test(char)
    })

    expect(unknown).toEqual([])
  })
})

describe("fitsSerp", () => {
  it("accepts a typical product title", () => {
    expect(fitsSerp("title", "Şef Bıçağı 20 cm - Paslanmaz Çelik | Örnek Marka")).toBe(true)
  })

  it("refuses a title that runs past the limit", () => {
    expect(fitsSerp("title", "W".repeat(40))).toBe(false)
  })

  it("uses the limits it publishes", () => {
    const text = "a".repeat(Math.floor(SERP_LIMITS.description.maxPx / (0.556 * 14)))

    expect(fitsSerp("description", text)).toBe(true)
    expect(fitsSerp("description", `${text}aaaa`)).toBe(false)
  })
})
