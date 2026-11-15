import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import type { QuickViewView } from "../quick-view-views"
import { forgetQuickViews, loadQuickView, QUICK_VIEW_KEPT_MS } from "../lib/quick-view"

const view = (price: string): QuickViewView =>
  ({
    id: "prod_1",
    path: "/urun/caki",
    variants: [{ id: "variant_1", price: { current: price } }],
    images: [],
  }) as unknown as QuickViewView

const answer = (body: unknown) => new Response(JSON.stringify(body), { status: 200 })

describe("quick view answers kept in the browser", () => {
  const fetchMock = vi.fn()

  beforeEach(() => {
    vi.useFakeTimers()
    fetchMock.mockReset()
    vi.stubGlobal("fetch", fetchMock)
    forgetQuickViews()
  })

  afterEach(() => {
    vi.useRealTimers()
    vi.unstubAllGlobals()
  })

  it("keeps an answer for a minute, so a second look asks nothing", async () => {
    fetchMock.mockResolvedValue(answer(view("450")))
    await loadQuickView("/api/quick-view", "prod_1")
    vi.advanceTimersByTime(QUICK_VIEW_KEPT_MS - 1)
    const again = await loadQuickView("/api/quick-view", "prod_1")
    expect(again.status).toBe("ready")
    expect(fetchMock).toHaveBeenCalledTimes(1)
  })

  it("asks again once the minute has passed", async () => {
    fetchMock.mockImplementationOnce(() => Promise.resolve(answer(view("450"))))
    fetchMock.mockImplementationOnce(() => Promise.resolve(answer(view("400"))))
    await loadQuickView("/api/quick-view", "prod_1")
    vi.advanceTimersByTime(QUICK_VIEW_KEPT_MS + 1)
    const again = await loadQuickView("/api/quick-view", "prod_1")
    expect(fetchMock).toHaveBeenCalledTimes(2)
    expect(again).toMatchObject({
      status: "ready",
      view: { variants: [{ price: { current: "400" } }] },
    })
  })

  it("forgets everything when asked to (a sign-in or sign-out)", async () => {
    fetchMock.mockImplementation(() => Promise.resolve(answer(view("450"))))
    await loadQuickView("/api/quick-view", "prod_1")
    forgetQuickViews()
    await loadQuickView("/api/quick-view", "prod_1")
    expect(fetchMock).toHaveBeenCalledTimes(2)
  })
})
