import { RESERVED_ROOT_SEGMENTS, SYSTEM_PAGES, isReservedPath } from "../paths"

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
    "/abonelik",
    "/stok-bildirimi",
    "/cerez-tercihleri",
    "/admin",
    "/store",
    // The sale page and the blog's archive prefixes (adr/0019 ek 2026-11-03)
    "/kampanyalar",
    "/blog/kategori",
    "/blog/etiket",
    // The category and brand indexes (docs/20) and the maintenance bypass page (adr/0053)
    "/kategoriler",
    "/markalar",
    "/bakim",
    // The gift card balance's root (adr/0025 Ek 2026-11-03) and the storefront's own routes
    "/hediye-karti",
    "/api",
    // A payment link's page, `/ode/<token>` (adr/0051)
    "/ode",
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
    "/abonelik/cik",
    "/stok-bildirimi-formu",
    // A blog archive's own path, and posts named like a word of it
    "/blog/kategori/bicak-bakimi",
    "/blog/etiket/celik",
    "/blog/kategoriler",
    "/kampanyalar-hakkinda",
    "/kategoriler/bicaklar",
    "/markalarimiz",
    "/bakim-seti",
    "/hediye-karti-seti",
    "/hediye-kartlari",
    "/api-anahtarligi",
    "/ode-sepeti",
    "/odeme-kolayligi",
  ])("leaves %s to records", (path) => {
    expect(isReservedPath(path)).toBe(false)
  })

  it("holds lowercase words, hyphen-joined: the form a stored path segment takes", () => {
    for (const segment of RESERVED_ROOT_SEGMENTS) {
      expect(segment).toMatch(/^[a-z]+(?:-[a-z]+)*$/)
    }
  })

  it("names the storefront's own pages, the token links among them, as nobody's search result", () => {
    expect(SYSTEM_PAGES).toEqual(
      expect.arrayContaining([
        { path: "/abonelik", robots: "noindex,nofollow" },
        { path: "/stok-bildirimi", robots: "noindex,nofollow" },
        { path: "/cerez-tercihleri", robots: "noindex,follow" },
        { path: "/bakim", robots: "noindex,nofollow" },
        { path: "/ode", robots: "noindex,nofollow" },
      ])
    )
    for (const { path } of SYSTEM_PAGES) {
      expect(isReservedPath(path)).toBe(true)
    }
  })
})
