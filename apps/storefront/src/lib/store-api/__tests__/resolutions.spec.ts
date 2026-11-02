import { describe, expect, it } from "vitest"
import type { Resolution } from "@qticaret/types"
import { storeCaches } from "../registry"
import { forgetResolutions, keepResolution, keptResolution } from "../resolutions"

const page: Resolution = {
  type: "entity",
  path: "/urun/keten-gomlek",
  entity_type: "product",
  entity_id: "prod_1",
}

describe("resolve answers kept in the process", () => {
  it("gives the proxy's answer to the page for ten seconds, keyed by the path and its query", () => {
    forgetResolutions()
    keepResolution("/urun/keten-gomlek", page, 1_000)
    expect(keptResolution("/urun/keten-gomlek", 1_000 + 9_999)).toEqual(page)
    expect(keptResolution("/urun/keten-gomlek?renk=mavi", 1_000)).toBeNull()
    expect(keptResolution("/urun/keten-gomlek", 1_000 + 10_000)).toBeNull()
    // A stale entry goes when met
    expect(storeCaches().resolve.has("/urun/keten-gomlek")).toBe(false)
  })

  it("keeps a page and a 404, never a redirect (its rule counts hits) nor a 410", () => {
    forgetResolutions()
    keepResolution("/yok", { type: "not_found", path: "/yok" }, 0)
    keepResolution("/eski", { type: "redirect", path: "/eski", status: 301, location: "/yeni" }, 0)
    keepResolution("/silindi", { type: "gone", path: "/silindi" }, 0)
    expect(keptResolution("/yok", 1)).toEqual({ type: "not_found", path: "/yok" })
    expect(keptResolution("/eski", 1)).toBeNull()
    expect(keptResolution("/silindi", 1)).toBeNull()
  })

  it("lives in the process-wide registry and is dropped whole by the refresh signal", () => {
    keepResolution("/urun/keten-gomlek", page)
    expect(storeCaches().resolve.size).toBeGreaterThan(0)
    forgetResolutions()
    expect(storeCaches().resolve.size).toBe(0)
  })

  it("stays bounded: past 500 paths the oldest go", () => {
    forgetResolutions()
    for (let index = 0; index < 510; index++) {
      keepResolution(`/sayfa-${String(index)}`, page, 0)
    }
    expect(storeCaches().resolve.size).toBe(500)
    expect(keptResolution("/sayfa-0", 1)).toBeNull()
    expect(keptResolution("/sayfa-509", 1)).toEqual(page)
  })
})
