import { createHmac } from "node:crypto"
import { describe, expect, it, vi } from "vitest"
import { refreshPlan } from "../contract"
import { handleRefresh } from "../handler"
import { AddressBudget, NonceLedger } from "../verify"

const SECRET = "a-test-secret-of-at-least-32-characters!!"
const NOW_MS = 1_800_000_000_000

function signed(scopes: string[], nonce = "ab".repeat(16), time = String(NOW_MS / 1000)) {
  const body = JSON.stringify({ scopes, at: Number(time), nonce })
  const signature = createHmac("sha256", SECRET)
    .update(`${time}.${nonce}.${scopes.join(",")}`)
    .digest("hex")
  return new Request("http://localhost:8000/api/yenile", {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "x-qt-refresh-time": time,
      "x-qt-refresh-signature": signature,
    },
    body,
  })
}

function deps(overrides: Partial<Parameters<typeof handleRefresh>[1]> = {}) {
  return {
    secret: SECRET,
    nowMs: NOW_MS,
    address: "127.0.0.1",
    nonces: new NonceLedger(),
    budget: new AddressBudget(30),
    forget: vi.fn(),
    ...overrides,
  }
}

describe("POST /api/yenile", () => {
  it("drops the scopes' caches and answers 204, never stored, without a body", async () => {
    const used = deps()
    const response = await handleRefresh(signed(["settings", "site"]), used)
    expect(response.status).toBe(204)
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(await response.text()).toBe("")
    expect(used.forget).toHaveBeenCalledWith(["settings", "site"])
  })

  it("answers 401 without a word for a bad signature, and drops nothing", async () => {
    const used = deps()
    const request = signed(["settings"])
    request.headers.set("x-qt-refresh-signature", "0".repeat(64))
    const response = await handleRefresh(request, used)
    expect(response.status).toBe(401)
    expect(await response.text()).toBe("")
    expect(response.headers.get("cache-control")).toBe("no-store")
    expect(used.forget).not.toHaveBeenCalled()
  })

  it("answers 401 to the same signal twice", async () => {
    const used = deps()
    expect((await handleRefresh(signed(["menus"]), used)).status).toBe(204)
    expect((await handleRefresh(signed(["menus"]), used)).status).toBe(401)
  })

  it("answers 401 to a body past 1 KB or not JSON", async () => {
    const big = new Request("http://localhost:8000/api/yenile", {
      method: "POST",
      body: JSON.stringify({ scopes: ["settings"], padding: "x".repeat(2000) }),
    })
    expect((await handleRefresh(big, deps())).status).toBe(401)
    const text = new Request("http://localhost:8000/api/yenile", { method: "POST", body: "{" })
    expect((await handleRefresh(text, deps())).status).toBe(401)
  })

  it("answers 404 without a shared secret, and 401 past the address's budget", async () => {
    expect((await handleRefresh(signed(["settings"]), deps({ secret: undefined }))).status).toBe(
      404
    )
    const budget = new AddressBudget(1)
    expect((await handleRefresh(signed(["settings"]), deps({ budget }))).status).toBe(204)
    const second = await handleRefresh(signed(["settings"], "cd".repeat(16)), deps({ budget }))
    expect(second.status).toBe(401)
  })
})

describe("the scopes' caches (adr/0048 Ek 2026-11-03)", () => {
  it("drops each scope's Store paths, and the edge's site only for `site`", () => {
    // The content pages' own layouts go with the design (adr/0073 §6)
    expect(refreshPlan(["layout"])).toEqual({
      paths: ["/store/storefront-layout", "/store/storefront-layout/pages/"],
      edgeSite: false,
    })
    expect(refreshPlan(["settings"])).toEqual({
      paths: ["/store/storefront", "/store/seo/site", "/store/legal-identity"],
      edgeSite: false,
    })
    expect(refreshPlan(["menus"]).paths).toEqual([
      "/store/storefront-menus",
      "/store/category-images",
      "/store/category-counts",
    ])
    expect(refreshPlan(["legal"]).paths).toEqual([
      "/store/legal/",
      "/store/legal-identity",
      "/store/storefront-menus",
    ])
    expect(refreshPlan(["content"]).paths).toEqual([
      "/store/content/terms",
      "/store/seo/paths",
      "/store/storefront-menus",
      "/store/storefront-layout/pages/",
    ])
    expect(refreshPlan(["site"])).toEqual({ paths: ["/store/seo/site"], edgeSite: true })
    // Each path once, whatever the scopes share
    expect(refreshPlan(["settings", "legal", "site"]).paths).toEqual([
      "/store/storefront",
      "/store/seo/site",
      "/store/legal-identity",
      "/store/legal/",
      "/store/storefront-menus",
    ])
  })
})
