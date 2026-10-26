import { normalizeCode } from "../code"

describe("promotion codes (ADR-0024)", () => {
  it("keeps codes in capitals, Turkish letters in ASCII", () => {
    expect(normalizeCode(" yaz10 ")).toBe("YAZ10")
    expect(normalizeCode("İndirim-Şok_çğüö")).toBe("INDIRIM-SOK_CGUO")
    expect(normalizeCode("ılık")).toBe("ILIK")
    expect(normalizeCode("KIŞ")).toBe("KIS")
  })

  it("reads a code typed any way as the same code", () => {
    const stored = normalizeCode("Bahar2026")
    for (const typed of ["bahar2026", "BAHAR2026", "BahaR2026"]) {
      expect(normalizeCode(typed)).toBe(stored)
    }
  })
})
