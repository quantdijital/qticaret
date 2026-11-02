import { describe, expect, it } from "vitest"
import { storeCaches } from "../../store-api/registry"
import { shared } from "../../store-api/shared"
import { forgetScopes } from "../scopes"

describe("forgetting by scope", () => {
  it("drops the shared answers and the edge's site the scopes touched, nothing else", async () => {
    const caches = storeCaches()
    caches.edge.set("site", { until: Date.now() + 60_000, value: {} })
    for (const key of [
      "/store/storefront?{}",
      "/store/seo/site?{}",
      "/store/storefront-layout?{}",
      "/store/product-categories?{}",
    ]) {
      await shared(key, () => Promise.resolve(1))
    }
    forgetScopes(["settings"])
    expect(caches.edge.has("site")).toBe(true)
    expect([...caches.shared.keys()].sort()).toEqual([
      "/store/product-categories?{}",
      "/store/storefront-layout?{}",
    ])
    forgetScopes(["site", "layout"])
    expect(caches.edge.has("site")).toBe(false)
    expect([...caches.shared.keys()]).toEqual(["/store/product-categories?{}"])
  })
})
