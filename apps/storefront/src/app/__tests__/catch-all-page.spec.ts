import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ headers: new Headers() }))
const requests = vi.hoisted(() => ({ resolvePath: vi.fn() }))

vi.mock("next/headers", () => ({ headers: () => Promise.resolve(state.headers) }))
vi.mock("@/lib/store-api/requests", () => requests)
vi.mock("next/navigation", () => ({
  notFound: () => {
    throw new Error("NEXT_NOT_FOUND")
  },
  permanentRedirect: vi.fn(),
  redirect: vi.fn(),
}))

const { default: CatchAllPage, generateMetadata } = await import("../[...path]/page")

const params = (...path: string[]) => ({ params: Promise.resolve({ path }) })

/**
 * adr/0053 Ek 2026-11-15, second review: Next falls back to this page for a
 * build file that is not there (`/_next/static/<none>`), often without the
 * proxy. Nothing of the shop's lives under `/_next`: a 404, no resolve.
 */
describe("the catch-all page under /_next", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // What a request that skipped the proxy may carry: nothing the page should trust
    state.headers = new Headers({ "x-qt-url": "/urun/keten-gomlek" })
    requests.resolvePath.mockResolvedValue({ type: "not_found" })
  })

  it("is a 404 asked of no backend", async () => {
    for (const path of [
      ["_next", "static", "x.js"],
      ["_next", "static", "chunks", "a.js"],
      ["_next", "data", "b", "x.json"],
    ]) {
      await expect(CatchAllPage(params(...path)), path.join("/")).rejects.toThrow("NEXT_NOT_FOUND")
      const metadata = await generateMetadata(params(...path))
      expect(metadata.robots).toBe("noindex,follow")
    }
    expect(requests.resolvePath).not.toHaveBeenCalled()
  })

  it("still asks the backend for any other address", async () => {
    await expect(CatchAllPage(params("urun", "keten-gomlek"))).rejects.toThrow("NEXT_NOT_FOUND")
    await generateMetadata(params("_nextx"))
    expect(requests.resolvePath).toHaveBeenCalledWith("/urun/keten-gomlek")
    expect(requests.resolvePath).toHaveBeenCalledTimes(2)
  })
})
