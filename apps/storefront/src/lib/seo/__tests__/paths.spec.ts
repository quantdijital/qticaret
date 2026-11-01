import { describe, expect, it } from "vitest"
import { backendFile, isSystemPath, normalizedPath } from "../paths"

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
