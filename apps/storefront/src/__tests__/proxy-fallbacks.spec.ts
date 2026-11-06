import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Env from "@/lib/env"
import { noteRateLimited } from "@/lib/store-api/busy"
import { storeCaches } from "@/lib/store-api/registry"

const edge = vi.hoisted(() => ({
  edgeSite: vi.fn(),
  resolveForProxy: vi.fn(),
  reportNotFound: vi.fn(),
  backendFileResponse: vi.fn(),
}))
vi.mock("@/lib/store-api/edge", () => edge)
vi.mock("@/lib/maintenance/gate", () => ({
  maintenanceGate: vi.fn(() => Promise.resolve({ blocked: null, bypassed: false })),
}))
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof Env>()),
  storefrontEnv: () => ({ NODE_ENV: "development" }),
}))

const { proxy } = await import("../proxy")

const visit = (path: string, init?: ConstructorParameters<typeof NextRequest>[1]) =>
  proxy(new NextRequest(`http://localhost:8000${path}`, init))

/**
 * The proxy's own answers for a missing address and a rate-limited visitor
 * (docs/21 2026-11-06, 4 and 10): the theme's 404 rendered as a page (Next
 * 16 sends a page that throws `notFound()` as an empty shell), and a 503
 * with `Retry-After` where a page would fail with a 500.
 */
describe("the proxy's 404", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeCaches().busy.clear()
    edge.edgeSite.mockResolvedValue({
      indexing: true,
      canonicalHost: null,
      indexNowKey: null,
      shopName: "",
      maintenance: { enabled: false },
      tracking: { ga4: null, meta: null },
    })
    edge.resolveForProxy.mockResolvedValue({ type: "not_found", path: null })
  })

  it("rewrites an address nothing lives at to the not-found page, with its 404 and CSP", async () => {
    const response = await visit("/urun/olmayan")
    expect(response.status).toBe(404)
    expect(response.headers.get("x-middleware-rewrite")).toBe("http://localhost:8000/_bulunamadi")
    expect(response.headers.get("x-middleware-request-x-qt-not-found")).toBe("1")
    // The address the page renders is the visitor's, not the rewrite's
    expect(response.headers.get("x-middleware-request-x-qt-url")).toBe("/urun/olmayan")
    expect(response.headers.get("content-security-policy")).toBeTruthy()
    expect(edge.reportNotFound).toHaveBeenCalledWith("/urun/olmayan", null, null)
  })

  it("rewrites a prefetch too, but reports only a visit", async () => {
    const response = await visit("/hic-olmayan", { headers: { "next-router-prefetch": "1" } })
    expect(response.status).toBe(404)
    expect(edge.reportNotFound).not.toHaveBeenCalled()
  })

  it("lets the home page and a list render whatever their old platform's query", async () => {
    for (const address of ["/?p=999999", "/magaza?paged=4"]) {
      const response = await visit(address)
      expect(response.status).toBe(200)
      expect(response.headers.get("x-middleware-rewrite")).toBeNull()
    }
  })

  it("leaves a page resolve could not answer to the page", async () => {
    edge.resolveForProxy.mockResolvedValue(null)
    const response = await visit("/urun/bir-urun")
    expect(response.status).toBe(200)
    expect(response.headers.get("x-middleware-rewrite")).toBeNull()
  })

  it("never takes the visitor's own mark, and the page by its own address is not resolved", async () => {
    const response = await visit("/_bulunamadi", { headers: { "x-qt-not-found": "1" } })
    expect(edge.resolveForProxy).not.toHaveBeenCalled()
    expect(response.headers.get("x-middleware-request-x-qt-not-found")).toBeNull()
    expect(response.headers.get("x-middleware-override-headers") ?? "").not.toContain(
      "x-qt-not-found"
    )
  })
})

describe("the proxy while the backend's rate limit holds the visitor", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeCaches().busy.clear()
    edge.edgeSite.mockResolvedValue({
      indexing: true,
      canonicalHost: null,
      indexNowKey: null,
      shopName: "",
      maintenance: { enabled: false },
      tracking: { ga4: null, meta: null },
    })
    edge.resolveForProxy.mockResolvedValue({ type: "entity", path: "/urun/bir-urun" })
  })

  it("answers a catalogue page 503 with the backend's Retry-After, never stored", async () => {
    noteRateLimited(null, "42")
    for (const address of ["/", "/magaza?renk=mavi", "/arama?q=cakı", "/urun/bir-urun"]) {
      const response = await visit(address)
      expect(response.status).toBe(503)
      expect(Number(response.headers.get("retry-after"))).toBeGreaterThanOrEqual(41)
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(response.headers.get("x-robots-tag")).toBeNull()
      expect(await response.text()).toBe("Çok fazla deneme yapıldı. Biraz sonra tekrar deneyin.")
    }
    expect(edge.resolveForProxy).not.toHaveBeenCalled()
  })

  it("keeps the cart, checkout, a payment's return and the forms out of it", async () => {
    noteRateLimited(null, "42")
    for (const address of ["/sepet", "/odeme", "/odeme/sonuc", "/hesap", "/api/search/suggest"]) {
      expect((await visit(address)).status).not.toBe(503)
    }
    expect((await visit("/urun/bir-urun", { method: "POST" })).status).not.toBe(503)
  })

  it("answers 503 for the very page whose resolve met the limit", async () => {
    edge.resolveForProxy.mockImplementation(() => {
      noteRateLimited(null, "7")
      return Promise.resolve(null)
    })
    const response = await visit("/urun/bir-urun")
    expect(response.status).toBe(503)
    expect(response.headers.get("retry-after")).toBe("7")
  })

  it("goes back to pages once the wait is over, and counts per visitor", async () => {
    noteRateLimited("203.0.113.9", "42")
    expect((await visit("/urun/bir-urun")).status).toBe(200)
    noteRateLimited(null, "1", Date.now() - 2000)
    expect((await visit("/urun/bir-urun")).status).toBe(200)
  })
})
