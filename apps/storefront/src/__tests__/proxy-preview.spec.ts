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
    // The theme editor's live session's frame asks its quick view the same way (adr/0065)
    const session = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
    expect((await visit(`/onizleme/${session}/hizli-bakis?id=prod_01`)).headers.get(header)).toBe(
      session
    )
    expect((await visit(`/onizleme/${session}/baska`)).headers.get(header)).toBeNull()
  })

  it("passes a saved look's link on (adr/0064): framed by the panel only, noindex, never stored", async () => {
    const look = `sfd_01JLOOK.to51q5.${"c".repeat(43)}`
    const header = "x-middleware-request-x-qt-layout-preview"
    const response = await visit(`/onizleme/${look}?gorsel=1`)
    expect(response.headers.get(header)).toBe(look)
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors http://localhost:5173"
    )
    expect((await visit(`/onizleme/${look}/hizli-bakis?id=prod_01`)).headers.get(header)).toBe(look)
    // Another form of id is no look's: no design header
    const forged = await visit(`/onizleme/sfd_01J-LOOK.to51q5.${"c".repeat(43)}`)
    expect(forged.headers.get(header)).toBeNull()
  })

  it("drops a preview header a visitor sends itself", async () => {
    const forged = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
    // The shop's own quick view answers and a product page: neither reads a draft
    for (const path of ["/urun/bir-urun", "/urun/x", "/api/quick-view?id=prod_01"]) {
      const response = await proxy(
        new NextRequest(`http://localhost:8000${path}`, {
          headers: { "x-qt-layout-preview": forged },
        })
      )
      expect(response.headers.get("x-middleware-request-x-qt-layout-preview")).toBeNull()
      // The page gets the proxy's headers in place of the visitor's: the forged one is not among them
      const forwarded = response.headers.get("x-middleware-override-headers")?.split(",") ?? []
      expect(forwarded).toContain("x-qt-url")
      expect(forwarded).not.toContain("x-qt-layout-preview")
    }
  })

  it("sets no draft header on an encoded or slash-ended quick view address", async () => {
    const design = `sfl_01JABCDEF.to51q5.${"a".repeat(43)}`
    const header = "x-middleware-request-x-qt-layout-preview"
    // `%2F` is no path separator here: not the quick view's address, still never indexed
    const encoded = await visit(`/onizleme/${design}%2Fhizli-bakis?id=prod_01`)
    expect(encoded.headers.get(header)).toBeNull()
    expect(encoded.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(encoded.headers.get("cache-control")).toBe("private, no-store")
    // A trailing slash: one 301 to the clean address, the token's case kept, no header on the way
    for (const path of [`/onizleme/${design}/hizli-bakis/`, `/onizleme/${design}/`]) {
      const slashed = await visit(`${path}?id=prod_01`)
      expect(slashed.status).toBe(301)
      expect(slashed.headers.get("location")).toBe(
        `http://localhost:8000${path.slice(0, -1)}?id=prod_01`
      )
      expect(slashed.headers.get(header)).toBeNull()
    }
  })

  it("leaves a live product page indexable", async () => {
    const response = await visit("/urun/bir-urun")
    expect(response.headers.get("x-robots-tag")).toBeNull()
    expect(response.headers.get("cache-control")).not.toBe("private, no-store")
  })

  it("passes the theme editor's live session on to the page, framed by the panel only, never stored", async () => {
    const session = `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}`
    const response = await visit(`/onizleme/${session}?sayfa=%2Furun%2Fbir-urun`)
    expect(response.headers.get("x-middleware-request-x-qt-layout-preview")).toBe(session)
    expect(response.headers.get("x-robots-tag")).toBe("noindex, nofollow")
    expect(response.headers.get("cache-control")).toBe("private, no-store")
    expect(response.headers.get("content-security-policy")).toContain(
      "frame-ancestors http://localhost:5173"
    )
    // An uppercase or longer id is no session's: no draft header
    const forged = await visit(`/onizleme/sfs_${"0A".repeat(16)}.to51q5.${"b".repeat(43)}`)
    expect(forged.headers.get("x-middleware-request-x-qt-layout-preview")).toBeNull()
  })

  it("never takes the draft's header from the visitor, and sets none on a live page", async () => {
    const request = new NextRequest("http://localhost:8000/urun/bir-urun", {
      headers: { "x-qt-layout-preview": `sfs_${"0a".repeat(16)}.to51q5.${"b".repeat(43)}` },
    })
    const response = await proxy(request)
    expect(response.headers.get("x-middleware-request-x-qt-layout-preview")).toBeNull()
    expect(response.headers.get("content-security-policy")).toContain("frame-ancestors 'none'")
  })
})
