import { assertClaimable } from "../validation"

const claim = (path: string) => () => {
  assertClaimable({ locale: "tr", path })
}

describe("assertClaimable (docs/13 §2.2, adr/0017 Ek 2026-11-23)", () => {
  it.each(["/arama", "/sepet", "/blog/kategori", "/sitemap-urunler"])(
    "refuses %s, a path the storefront keeps",
    (path) => {
      expect(claim(path)).toThrow("seo.path_reserved")
    }
  )

  it.each([
    "/sepet/indirim",
    "/yasal/kvkk",
    "/hediye-karti/bakiye",
    "/hesap/siparisler/x",
    "/sitemap-x/y",
  ])("refuses %s: under a root the storefront's own routes answer", (path) => {
    expect(claim(path)).toThrow("seo.path_reserved")
  })

  it.each([
    "/urun/sef-bicagi",
    "/kategori/mutfak/bicaklar",
    "/marka/ornek-marka",
    "/koleksiyon/yaz-indirimi",
    "/blog/bicak-bakimi",
    "/blog/kategori/bakim",
    "/hediyelik-esyalar/caki-kutusu",
    "/hesap-makineleri/bilimsel",
    "/caki-kutusu",
  ])("lets a record take %s", (path) => {
    expect(claim(path)).not.toThrow()
  })
})
