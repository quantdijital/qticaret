import { RESERVED_ROOT_SEGMENTS, isReservedPath } from "../paths"

describe("isReservedPath", () => {
  it.each([
    "/arama",
    "/sepet",
    "/urun",
    "/kategori",
    "/blog",
    "/siparis",
    "/yasal",
    "/magaza",
    "/yorumlar",
    "/admin",
    "/store",
  ])("keeps %s for the storefront", (path) => {
    expect(isReservedPath(path)).toBe(true)
  })

  it.each([
    // What the prefixes are for
    "/urun/sef-bicagi",
    "/kategori/bicak/sef-bicaklari",
    // A slug that only starts or ends like a reserved word
    "/aramalar",
    "/sepet-cantasi",
    "/bicak-blog",
    "/sef-bicagi",
  ])("leaves %s to records", (path) => {
    expect(isReservedPath(path)).toBe(false)
  })

  it("holds plain lowercase words, the form a stored path segment takes", () => {
    for (const segment of RESERVED_ROOT_SEGMENTS) {
      expect(segment).toMatch(/^[a-z]+$/)
    }
  })
})
