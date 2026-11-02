import { describe, expect, it } from "vitest"
import { previewPage } from "../preview"

const shown = (raw: string | string[] | undefined) => {
  const page = previewPage(raw)
  return page.kind === "home" ? "home" : `${page.kind} ${page.url.pathname}${page.url.search}`
}

describe("previewPage (?sayfa= of a design preview)", () => {
  it("shows a record's page, the catalogue or the blog with their own query", () => {
    expect(shown("/urun/keten-gomlek?variant=v_1")).toBe("resolve /urun/keten-gomlek?variant=v_1")
    expect(shown("/kategori/bicaklar")).toBe("resolve /kategori/bicaklar")
    expect(shown("/magaza?sirala=fiyat-artan")).toBe("shop /magaza?sirala=fiyat-artan")
    expect(shown("/blog?sayfa=2")).toBe("blog /blog?sayfa=2")
  })

  it("asks for the one form of the address the live page has", () => {
    expect(shown("/Kategori/Bicaklar/")).toBe("resolve /kategori/bicaklar")
    expect(shown("/magaza/#ust")).toBe("shop /magaza")
  })

  it("falls back to the home page for anything else", () => {
    for (const raw of [
      undefined,
      ["/magaza", "/blog"],
      "",
      "/",
      "magaza",
      "//evil.example/x",
      "/\\evil.example",
      "https://evil.example/urun/x",
      "/sepet",
      "/onizleme/sfl_x",
      "/hesap/siparisler",
      "/yorumlar",
      `/${"a".repeat(2048)}`,
    ]) {
      expect(shown(raw)).toBe("home")
    }
  })
})
