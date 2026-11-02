import { describe, expect, it, vi } from "vitest"
import { storeCaches } from "../registry"
import { forgetShared, shared } from "../shared"

describe("shared shop-wide answers", () => {
  it("asks once within the time, again after it", async () => {
    vi.useFakeTimers()
    const load = vi.fn(() => Promise.resolve("x"))
    await shared("a", load, 1000)
    await shared("a", load, 1000)
    expect(load).toHaveBeenCalledTimes(1)
    vi.advanceTimersByTime(1001)
    await shared("a", load, 1000)
    expect(load).toHaveBeenCalledTimes(2)
    vi.useRealTimers()
  })

  it("does not keep a failure", async () => {
    const failing = vi.fn(() => Promise.reject(new Error("busy")))
    await expect(shared("b", failing)).rejects.toThrow("busy")
    await Promise.resolve()
    const ok = vi.fn(() => Promise.resolve("y"))
    await expect(shared("b", ok)).resolves.toBe("y")
  })

  it("keeps its answers where every bundle of the process sees them", async () => {
    await shared("/store/x?{}", () => Promise.resolve(1))
    expect(storeCaches().shared.has("/store/x?{}")).toBe(true)
  })

  it("forgets a path whatever its query, a prefix's whole tree, and nothing that only starts alike", async () => {
    const load = () => Promise.resolve("v")
    for (const key of [
      "/store/storefront?{}",
      "/store/storefront-layout?{}",
      "/store/storefront-menus?{}",
      '/store/seo/paths?{"type":"product","id":["a"]}',
      '/store/seo/paths?{"type":"brand","id":["b"]}',
      "/store/legal/cookie_policy?{}",
      "/store/legal-identity?{}",
    ]) {
      await shared(key, load)
    }
    expect(forgetShared(["/store/storefront", "/store/seo/paths", "/store/legal/"])).toBe(4)
    const left = [...storeCaches().shared.keys()]
    expect(left).toContain("/store/storefront-layout?{}")
    expect(left).toContain("/store/storefront-menus?{}")
    expect(left).toContain("/store/legal-identity?{}")
    expect(left.some((key) => key.startsWith("/store/seo/paths"))).toBe(false)
    expect(left).not.toContain("/store/storefront?{}")
  })
})
