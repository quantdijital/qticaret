import { CODE128_PATTERNS, code128Svg, code128Values } from "../code128"

describe("Code 128 (adr/0035)", () => {
  it("has the standard's symbols: 11 modules, three bars of even and spaces of odd width", () => {
    const symbols = CODE128_PATTERNS.slice(0, 106)
    const digits = (pattern: string) => Array.from(pattern, Number)

    expect(new Set(CODE128_PATTERNS).size).toBe(107)
    for (const pattern of symbols) {
      const [b1 = 0, s1 = 0, b2 = 0, s2 = 0, b3 = 0, s3 = 0] = digits(pattern)
      expect(b1 + s1 + b2 + s2 + b3 + s3).toBe(11)
      expect((b1 + b2 + b3) % 2).toBe(0)
      expect((s1 + s2 + s3) % 2).toBe(1)
    }
    expect(digits(CODE128_PATTERNS[106] ?? "").reduce((sum, each) => sum + each, 0)).toBe(13)
  })

  it("starts in set B, weighs each symbol by its place for the check, and stops", () => {
    // (104 + 33×1 + 34×2 + 35×3) mod 103 = 1
    expect(code128Values("ABC")).toEqual([104, 33, 34, 35, 1, 106])
    expect(() => code128Values("İSTANBUL")).toThrow(RangeError)
    expect(() => code128Values("")).toThrow(RangeError)
  })

  it("draws the modules with quiet zones at the module width asked", () => {
    const svg = code128Svg("ABC")

    // 10 + 5 symbols × 11 + stop 13 + 10 modules, at 0.375 mm
    expect(svg).toContain('viewBox="0 0 88 48"')
    expect(svg).toContain('width="33.00mm"')
    expect(svg.match(/M\d+ 0h\d/g)).toHaveLength(5 * 3 + 4)
  })
})
