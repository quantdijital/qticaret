import {
  AA_LARGE_TEXT,
  contrastRatio,
  hexChannels,
  meetsContrast,
  relativeLuminance,
} from "../contrast"

describe("colour contrast (WCAG 2.2)", () => {
  it("reads #rrggbb in either case, and nothing else", () => {
    expect(hexChannels("#1A1814")).toEqual([26, 24, 20])
    expect(hexChannels(" #ffffff ")).toEqual([255, 255, 255])
    for (const bad of ["#fff", "1a1814", "#1a181", "#1a18144", "red", "#gggggg", ""]) {
      expect(hexChannels(bad)).toBeNull()
    }
    expect(() => relativeLuminance("red")).toThrow("color.hex_invalid")
  })

  it("gives black and white their luminance, and the extremes of the ratio", () => {
    expect(relativeLuminance("#000000")).toBe(0)
    expect(relativeLuminance("#ffffff")).toBeCloseTo(1, 10)
    expect(contrastRatio("#000000", "#ffffff")).toBeCloseTo(21, 10)
    expect(contrastRatio("#777777", "#777777")).toBe(1)
  })

  it("matches the ratios WCAG's own tools give", () => {
    // #767676 on white is the well-known lightest grey for AA text (4.54:1)
    expect(contrastRatio("#767676", "#ffffff")).toBeCloseTo(4.54, 2)
    // The panel's default brand colour, worked by hand from the formula
    expect(contrastRatio("#2f6feb", "#ffffff")).toBeCloseTo(4.57, 2)
    expect(contrastRatio("#949494", "#ffffff")).toBeCloseTo(3.03, 2)
    // The base theme's ink on its page (styles.css)
    expect(contrastRatio("#1a1814", "#f6f4ef")).toBeGreaterThan(15)
  })

  it("does not care which colour comes first", () => {
    expect(contrastRatio("#ffffff", "#2f6feb")).toBe(contrastRatio("#2f6feb", "#ffffff"))
  })

  it("draws the AA line for large text at 3:1", () => {
    expect(AA_LARGE_TEXT).toBe(3)
    expect(meetsContrast("#949494", "#ffffff")).toBe(true)
    expect(meetsContrast("#959595", "#ffffff")).toBe(false)
    expect(meetsContrast("#767676", "#ffffff", 4.5)).toBe(true)
    expect(meetsContrast("#777777", "#ffffff", 4.5)).toBe(false)
  })
})
