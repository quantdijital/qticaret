import { describe, expect, it } from "vitest"
import { previewPage } from "../preview"

const shown = (raw: string | string[] | undefined) => {
  const page = previewPage(raw)
  return page.kind === "home"
    ? "home"
    : page.kind === "content"
      ? `content ${page.id}`
      : `${page.kind} ${page.url.pathname}${page.url.search}`
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

  it("draws the cart and the search on a live session only (adr/0065 Ek 2026-11-15)", () => {
    const cart = previewPage("/sepet/?hata=cart.update_failed", { system: true })
    expect(cart.kind).toBe("cart")
    expect(cart.kind === "cart" && cart.url.search).toBe("?hata=cart.update_failed")
    expect(previewPage("/arama?q=b%C4%B1%C3%A7ak", { system: true }).kind).toBe("search")
    // A shared link keeps today's pages
    expect(previewPage("/sepet").kind).toBe("home")
    expect(previewPage("/arama?q=x").kind).toBe("home")
    // Never checkout, an account or another system page
    for (const raw of ["/odeme", "/odeme/sonuc", "/hesap", "/giris", "/onizleme/sfs_x", "/api/x"]) {
      expect(previewPage(raw, { system: true }).kind).toBe("home")
    }
    // Case, dot segments and escapes do not reach checkout either
    for (const raw of ["/Odeme", "/ODEME", "/sepet/../odeme", "/%6fdeme", "/sepet/%2e%2e/odeme"]) {
      expect(previewPage(raw, { system: true }).kind).not.toBe("cart")
      expect(previewPage(raw, { system: true }).kind).not.toBe("search")
    }
  })

  it("opens a content page by its id (`?icerik=`) on a live session only (adr/0073 §5)", () => {
    // The panel sends a draft page's path and its id; the id names it, in draft too
    expect(previewPage("/iade-kosullari", { system: true, content: "cnt_01KABC" })).toEqual({
      kind: "content",
      id: "cnt_01KABC",
    })
    expect(previewPage(undefined, { system: true, content: "cnt_iade" })).toEqual({
      kind: "content",
      id: "cnt_iade",
    })
    // A shared design link (`sfl_`) never shows a draft page: the id is not read
    const shared = previewPage("/iade-kosullari", { content: "cnt_01KABC" })
    expect(shared.kind).toBe("resolve")
    expect(previewPage(undefined, { content: "cnt_01KABC" }).kind).toBe("home")
    expect(previewPage("/iade-kosullari", { system: false, content: "cnt_01KABC" }).kind).toBe(
      "resolve"
    )
  })

  it("reads only a content page's id of the one form (`cnt_…`)", () => {
    for (const content of [
      undefined,
      "",
      "cnt_",
      "cnt_../x",
      "cnt_a b",
      "prod_01KABC",
      "CNT_01KABC",
      `cnt_${"a".repeat(41)}`,
      ["cnt_01KABC", "cnt_02KABC"],
    ]) {
      expect(previewPage("/iade-kosullari", { system: true, content }).kind).toBe("resolve")
    }
  })
})
