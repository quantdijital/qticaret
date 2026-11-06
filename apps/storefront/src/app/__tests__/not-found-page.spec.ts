import { atolyeTheme } from "@qticaret/theme-atolye"
import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(state.headers) }))
vi.mock("@/lib/views/category-tiles", () => ({
  waysOn: () => Promise.resolve([{ label: "Çakılar", path: "/kategori/cakilar", image: null }]),
}))

const { theme } = await import("@/theme")
const { default: Missing, metadata } = await import("../%5Fbulunamadi/page")

/**
 * `/_bulunamadi` (docs/21 2026-11-06, 4): the 404 an unknown address gets
 * through the proxy's rewrite. Rendered as a page, not thrown, so all of it
 * is in the first HTML: Next 16 sends a page that throws `notFound()` as an
 * empty error shell.
 */
describe("the not-found page", () => {
  beforeEach(() => {
    state.headers = new Headers({ "x-qt-not-found": "1" })
  })

  it("draws the theme's 404 when the proxy sent the request", async () => {
    const html = renderToStaticMarkup(await Missing())
    expect(html).toMatch(/<h1[^>]*>Sayfa bulunamadı<\/h1>/)
    expect(html).toContain('href="/"')
  })

  it("gives the Grafit theme's heading, search and category tiles, whole", async () => {
    const own = theme.NotFoundPage
    theme.NotFoundPage = atolyeTheme.NotFoundPage
    try {
      const html = renderToStaticMarkup(await Missing())
      expect(html).toMatch(/<h1[^>]*>Sayfa bulunamadı<\/h1>/)
      expect(html).toMatch(/<form[^>]*action="\/arama"/)
      expect(html).toMatch(/<input[^>]*type="search"/)
      expect(html).toContain('href="/kategori/cakilar"')
    } finally {
      theme.NotFoundPage = own
    }
  })

  it("is never indexed and names itself, whatever the shop's title template", () => {
    expect(metadata.robots).toBe("noindex,follow")
    expect(metadata.title).toEqual({ absolute: "Sayfa bulunamadı" })
  })

  it("is no page by its own address", async () => {
    state.headers = new Headers()
    await expect(Missing()).rejects.toThrow()
  })
})
