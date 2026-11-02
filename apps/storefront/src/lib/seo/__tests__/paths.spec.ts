import { describe, expect, it } from "vitest"
import {
  backendFile,
  BLOG_ARCHIVE_PREFIXES,
  canonicalHostRedirect,
  indexNowFile,
  isStorefrontIndex,
  isSystemPath,
  normalizedPath,
} from "../paths"

describe("normalizedPath", () => {
  it("leaves a clean path alone", () => {
    expect(normalizedPath("/")).toBeNull()
    expect(normalizedPath("/urun/keten-gomlek")).toBeNull()
  })

  it("gives one address for case, slashes and index.html (docs/13 §2.2)", () => {
    expect(normalizedPath("/Urun/Keten-Gomlek")).toBe("/urun/keten-gomlek")
    expect(normalizedPath("//urun///keten-gomlek")).toBe("/urun/keten-gomlek")
    expect(normalizedPath("/kategori/giyim/")).toBe("/kategori/giyim")
    expect(normalizedPath("/index.html")).toBe("/")
    expect(normalizedPath("/kategori/index.html")).toBe("/kategori")
  })

  it("keeps the case of the storefront's own pages (order ids, tokens)", () => {
    expect(normalizedPath("/siparis/order_01JABC")).toBeNull()
    expect(normalizedPath("/siparis/order_01JABC/")).toBe("/siparis/order_01JABC")
  })
})

describe("isSystemPath and backendFile", () => {
  it("knows the storefront's own pages", () => {
    expect(isSystemPath("/sepet")).toBe(true)
    expect(isSystemPath("/hesap/siparisler")).toBe(true)
    expect(isSystemPath("/sepetler-ve-kutular")).toBe(false)
    expect(isSystemPath("/")).toBe(false)
  })

  it("keeps a message's token links and the cookie choices as its own, token case and all", () => {
    expect(isSystemPath("/abonelik/cik")).toBe(true)
    expect(isSystemPath("/abonelik/onay")).toBe(true)
    expect(isSystemPath("/stok-bildirimi/onay")).toBe(true)
    expect(isSystemPath("/cerez-tercihleri")).toBe(true)
    expect(normalizedPath("/abonelik/cik")).toBeNull()
    expect(isSystemPath("/abonelikler-hakkinda")).toBe(false)
  })

  it("keeps the maintenance bypass page as its own (adr/0053), never resolved", () => {
    expect(isSystemPath("/bakim/gir")).toBe(true)
    expect(normalizedPath("/bakim/gir")).toBeNull()
    expect(isSystemPath("/bakim-seti")).toBe(false)
  })

  it("makes the category and brand indexes itself; resolve answers the sale page and archives", () => {
    expect(isStorefrontIndex("/kategoriler")).toBe(true)
    expect(isStorefrontIndex("/markalar")).toBe(true)
    expect(isStorefrontIndex("/kampanyalar")).toBe(false)
    expect(isStorefrontIndex("/kategoriler/bicak")).toBe(false)
    for (const prefix of Object.values(BLOG_ARCHIVE_PREFIXES)) {
      expect(isSystemPath(`${prefix}/bakim`)).toBe(false)
      expect(isStorefrontIndex(`${prefix}/bakim`)).toBe(false)
      expect(normalizedPath(`${prefix}/bakim`)).toBeNull()
    }
  })

  it("maps the root files to the backend", () => {
    expect(backendFile("/robots.txt")).toBe("/store/seo/robots")
    expect(backendFile("/sitemap.xml")).toBe("/store/seo/sitemaps/sitemap.xml")
    expect(backendFile("/sitemap-products-1.xml")).toBe(
      "/store/seo/sitemaps/sitemap-products-1.xml"
    )
    expect(backendFile("/.well-known/security.txt")).toBe("/store/seo/security")
    expect(backendFile("/sitemap-../x.xml")).toBeNull()
    expect(backendFile("/urun/x")).toBeNull()
  })
})

describe("canonicalHostRedirect", () => {
  it("sends another host to the shop's own, path and query kept", () => {
    expect(canonicalHostRedirect("magaza.example", "www.magaza.example", "/urun/a?x=1")).toBe(
      "https://www.magaza.example/urun/a?x=1"
    )
    expect(canonicalHostRedirect("shop.platform.example:443", "magaza.example", "/")).toBe(
      "https://magaza.example/"
    )
  })

  it("leaves the shop's own host alone, whatever its case or port", () => {
    expect(canonicalHostRedirect("WWW.Magaza.Example", "www.magaza.example", "/")).toBeNull()
    expect(canonicalHostRedirect("www.magaza.example:8000", "www.magaza.example", "/")).toBeNull()
  })

  it("does nothing until a host is set", () => {
    expect(canonicalHostRedirect("anything.example", null, "/")).toBeNull()
    expect(canonicalHostRedirect(null, "www.magaza.example", "/")).toBeNull()
  })
})

describe("indexNowFile", () => {
  // Built, not written out: a 32-character literal reads as a secret to the scanner
  const key = "ab".repeat(16)

  it("answers the key's own file only", () => {
    expect(indexNowFile(`/${key}.txt`, key)).toBe(key)
    expect(indexNowFile("/abababab.txt", key)).toBeNull()
    expect(indexNowFile(`/a/${key}.txt`, key)).toBeNull()
  })

  it("answers nothing while the shop does not announce", () => {
    expect(indexNowFile(`/${key}.txt`, null)).toBeNull()
  })
})
