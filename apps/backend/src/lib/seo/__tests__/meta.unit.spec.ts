import { isSitePath, seoTextHash } from "../meta"

describe("isSitePath", () => {
  it.each(["/urun/keten-gomlek", "/kategori/giyim/gomlek", "/"])("accepts %s", (path) => {
    expect(isSitePath(path)).toBe(true)
  })

  it.each([
    "https://rakip.com/urun",
    "//rakip.com/urun",
    "urun/keten",
    "/urun?ref=x",
    "/urun#bolum",
    "/a b",
    "/a\\b",
    "/kategori/../admin",
    `/${"a".repeat(600)}`,
  ])("refuses %s", (path) => {
    expect(isSitePath(path)).toBe(false)
  })
})

describe("seoTextHash", () => {
  it("matches texts that differ only in case and spaces, the Turkish way", () => {
    expect(seoTextHash("  Keten  GÖMLEK ")).toBe(seoTextHash("keten gömlek"))
    expect(seoTextHash("İzmir")).toBe(seoTextHash("izmir"))
    expect(seoTextHash("Keten gömlek")).not.toBe(seoTextHash("Keten pantolon"))
  })

  it("has no hash for empty text", () => {
    expect(seoTextHash("   ")).toBeNull()
    expect(seoTextHash(null)).toBeNull()
  })
})
