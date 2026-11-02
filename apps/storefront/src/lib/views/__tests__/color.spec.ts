import { describe, expect, it } from "vitest"
import { brandDeclarations, readableOn, swatchLookup } from "../color"

describe("brand colour", () => {
  it("puts white on a dark colour and ink on a light one", () => {
    expect(readableOn("#0b5c99")).toBe("#ffffff")
    expect(readableOn("#f5d90a")).toBe("#111113")
  })

  it("gives the tokens for a hex colour and nothing for anything else", () => {
    expect(brandDeclarations("#0b5c99")).toEqual([
      "--primary:#0b5c99",
      "--primary-foreground:#ffffff",
      "--ring:#0b5c99",
      "--announcement:#0b5c99",
      "--announcement-foreground:#ffffff",
    ])
    expect(brandDeclarations(null)).toEqual([])
    expect(brandDeclarations("red;}body{display:none")).toEqual([])
    expect(brandDeclarations("#0B5C99")).toEqual([])
  })
})

describe("swatchLookup", () => {
  it("finds a value's colour by its name, whatever its case (Turkish)", () => {
    const swatchOf = swatchLookup([
      { label: "Lacivert", hex: "#1e3a8a" },
      { label: "Işık Gri", hex: "#d1d5db" },
    ])
    expect(swatchOf(" LACİVERT ")).toBe("#1e3a8a")
    expect(swatchOf("lacivert")).toBe("#1e3a8a")
    expect(swatchOf("IŞIK GRİ")).toBe("#d1d5db")
    // Turkish casing: a dotless capital I is ı, not i
    expect(swatchOf("LACIVERT")).toBeNull()
    expect(swatchOf("Kırmızı")).toBeNull()
  })
})
