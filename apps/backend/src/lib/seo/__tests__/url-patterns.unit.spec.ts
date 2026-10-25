import { categoryPath, collectionPath, productPath } from "../url-patterns"

describe("catalog URL patterns (docs/13 §2.2)", () => {
  it("puts products under /urun, or at the root in the flat style", () => {
    expect(productPath("sef-bicagi", "prefixed")).toBe("/urun/sef-bicagi")
    expect(productPath("sef-bicagi", "flat")).toBe("/sef-bicagi")
  })

  it("carries the category tree in the prefixed style only", () => {
    const handles = ["mutfak", "bicaklar", "sef-bicaklari"]

    expect(categoryPath(handles, "prefixed")).toBe("/kategori/mutfak/bicaklar/sef-bicaklari")
    expect(categoryPath(handles, "flat")).toBe("/sef-bicaklari")
    expect(categoryPath(["mutfak"], "prefixed")).toBe("/kategori/mutfak")
  })

  it("needs the category's own handle", () => {
    expect(() => categoryPath([], "prefixed")).toThrow()
  })

  it("keeps collections under /koleksiyon", () => {
    expect(collectionPath("yaz-indirimi")).toBe("/koleksiyon/yaz-indirimi")
  })
})
