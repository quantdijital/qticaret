import { createElement } from "react"
import { renderToStaticMarkup } from "react-dom/server"
import { describe, expect, it } from "vitest"
import { atolyeTheme } from "@qticaret/theme-atolye"
import { ErrorPage as AtolyeErrorPage } from "@qticaret/theme-atolye/error"
import type { ThemeErrorPage } from "@qticaret/ui"
import { t } from "@/lib/i18n"
import { renderPage } from "@/test/theme-render"

/**
 * A page the server could not make (adr/0046 Ek 2026-11-05): the theme's
 * error page takes no data, so it stands with the backend away: the
 * words, "Tekrar dene" and the way home; no categories, no search.
 */
const render = (Page: ThemeErrorPage) =>
  renderToStaticMarkup(createElement(Page, { t, retry: () => undefined }))

describe("the theme's error page", () => {
  it("Atölye: a graphite panel with the words, a button to try again and the way home", () => {
    const html = render(AtolyeErrorPage)
    expect(html.match(/<h1/g)).toHaveLength(1)
    expect(html).toContain("Sayfa şu an açılamadı")
    expect(html).toMatch(/<button type="button" class="gf-btn">.*Tekrar dene<\/button>/)
    expect(html).toMatch(/<a href="\/"[^>]*>Ana sayfa<\/a>/)
    expect(html).toContain('class="gf-stage')
    expect(html).not.toContain('action="/arama"')
    expect(html).not.toContain("Kategorilere göz atın")
  })
})

describe("the theme's 410", () => {
  it("says the page was removed, with the way home and search", () => {
    const html = renderPage(atolyeTheme, "GonePage", {})
    expect(html).toContain("410")
    expect(html).toContain("Bu sayfa kaldırıldı")
    expect(html).toContain('action="/arama"')
    expect(html).toMatch(/<a href="\/"/)
  })
})
