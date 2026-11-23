import { CATEGORY_URL_STYLES, categoryPath, collectionPath, productPath } from "../url-patterns"

describe("catalog URL patterns (docs/13 §2.2)", () => {
  it("puts products under /urun, or at the root in the flat style", () => {
    expect(productPath("sef-bicagi", "prefixed")).toBe("/urun/sef-bicagi")
    expect(productPath("sef-bicagi", "flat")).toBe("/sef-bicagi")
  })

  it("carries the category tree in the prefixed and nested styles, not the flat one", () => {
    const handles = ["mutfak", "bicaklar", "sef-bicaklari"]

    expect(categoryPath(handles, "prefixed")).toBe("/kategori/mutfak/bicaklar/sef-bicaklari")
    expect(categoryPath(handles, "nested")).toBe("/mutfak/bicaklar/sef-bicaklari")
    expect(categoryPath(handles, "flat")).toBe("/sef-bicaklari")
    expect(categoryPath(["mutfak"], "prefixed")).toBe("/kategori/mutfak")
  })

  it("keeps a WooCommerce site's base-less category address as it was (adr/0017 Ek 2026-11-23)", () => {
    expect(categoryPath(["el-yapimi-caki", "damascus-cakilar"], "nested")).toBe(
      "/el-yapimi-caki/damascus-cakilar"
    )
  })

  it("gives a root category the same path nested and flat: a move between them leaves it", () => {
    expect(categoryPath(["hediyelik-esyalar"], "nested")).toBe(
      categoryPath(["hediyelik-esyalar"], "flat")
    )
  })

  it("makes a different path in each style for a subcategory", () => {
    const paths = CATEGORY_URL_STYLES.map((style) =>
      categoryPath(["hediyelik-esyalar", "caki-kutusu"], style)
    )
    expect(new Set(paths).size).toBe(CATEGORY_URL_STYLES.length)
  })

  it("needs the category's own handle", () => {
    expect(() => categoryPath([], "prefixed")).toThrow()
    expect(() => categoryPath([], "nested")).toThrow()
  })

  it("keeps collections under /koleksiyon", () => {
    expect(collectionPath("yaz-indirimi")).toBe("/koleksiyon/yaz-indirimi")
  })
})
