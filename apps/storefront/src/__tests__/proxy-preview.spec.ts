import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Env from "@/lib/env"
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

const TOKEN = `prod_01JABCDEF.to51q5.${"a".repeat(43)}`

const visit = (path: string) => proxy(new NextRequest(`http://localhost:8000${path}`))

/** A signed preview (F18): never indexed nor stored, whatever the page's own meta says. */
describe("the proxy on a preview page", () => {
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

  it("sends a draft product's preview with noindex, nofollow and no-store", async () => {
    const response = await visit(`/onizleme/${TOKEN}`)
    expect(response.status).toBe(200)
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    // Not a design preview: the draft design's header is not set
    expect(response.headers.get("x-middleware-request-x-qt-layout-preview")).toBeNull()
  })

  // adr/0049 Ek 2026-11-15: the frame's quick view dialog asks under the preview's address
  it("sets the draft design's header on a design preview and on its quick view answers", async () => {
    const design = `sfl_01JABCDEF.to51q5.${"a".repeat(43)}`
    const header = "x-middleware-request-x-qt-layout-preview"
    expect((await visit(`/onizleme/${design}`)).headers.get(header)).toBe(design)
    const answers = await visit(`/onizleme/${design}/hizli-bakis?id=prod_01`)
    expect(answers.headers.get(header)).toBe(design)
    expect(answers.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(answers.headers.get("cache-control")).toBe("private, no-store")
    // Nothing else under a preview's address carries the token on
    expect((await visit(`/onizleme/${design}/baska`)).headers.get(header)).toBeNull()
    expect((await visit(`/onizleme/${design}/hizli-bakis/x`)).headers.get(header)).toBeNull()
  })

  it("leaves a live product page indexable", async () => {
    const response = await visit("/urun/bir-urun")
    expect(response.headers.get("x-robots-tag")).toBeNull()
    expect(response.headers.get("cache-control")).not.toBe("private, no-store")
  })
})
