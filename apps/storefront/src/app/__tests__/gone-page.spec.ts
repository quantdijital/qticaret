import { renderToStaticMarkup } from "react-dom/server"
import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ headers: new Headers() }))

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(state.headers) }))
vi.mock("@/lib/views/category-tiles", () => ({ waysOn: () => Promise.resolve([]) }))

const { default: Gone, metadata } = await import("../%5Fkaldirildi/page")

/** `/_kaldirildi` (adr/0046 Ek 2026-11-05): the theme's removed page, reached only through the proxy. */
describe("the removed page", () => {
  beforeEach(() => {
    state.headers = new Headers()
  })

  it("draws the theme's 410 page when the proxy sent the request", async () => {
    state.headers = new Headers({ "x-qt-gone": "1" })
    const html = renderToStaticMarkup(await Gone())
    expect(html).toContain("410")
    expect(html).toContain("Bu sayfa kaldırıldı")
    expect(html).toContain('href="/"')
    expect(metadata.robots).toBe("noindex")
  })

  it("is no page by its own address", async () => {
    await expect(Gone()).rejects.toThrow()
  })
})
