import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type * as Env from "@/lib/env"
import type { EdgeSite } from "@/lib/store-api/edge"
import { storeCaches } from "@/lib/store-api/registry"

const edge = vi.hoisted(() => ({
  edgeSite: vi.fn(),
  resolveForProxy: vi.fn(),
  reportNotFound: vi.fn(),
  backendFileResponse: vi.fn(),
  checkBypass: vi.fn(),
}))
vi.mock("@/lib/store-api/edge", () => edge)
vi.mock("@/lib/env", async (original) => ({
  ...(await original<typeof Env>()),
  storefrontEnv: () => ({ NODE_ENV: "development" }),
}))

const { proxy } = await import("../proxy")

const TOKEN = `mnb_AbCdEfGhIjKlMnOp.zzzzzzzz.${"A".repeat(43)}`

const site = (suspended: boolean): EdgeSite => ({
  indexing: true,
  canonicalHost: null,
  indexNowKey: null,
  shopName: "Örnek Atölye",
  tracking: { ga4: null, meta: null },
  // The shop's own maintenance, with its words and open paths: none of it counts
  maintenance: {
    enabled: true,
    title: "Yenileniyoruz",
    message: "Yarın buradayız",
    expectedAt: null,
    allowPaths: ["/iletisim"],
  },
  suspended,
})

const visit = (path: string, init: { method?: string; cookie?: string } = {}) =>
  proxy(
    new NextRequest(`http://localhost:8000${path}`, {
      method: init.method ?? "GET",
      headers: init.cookie ? { cookie: init.cookie } : {},
    })
  )

/** adr/0061 §5.5, Ek C15: a shop the platform suspended. */
describe("the proxy for a suspended shop", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    storeCaches().busy.clear()
    edge.edgeSite.mockResolvedValue(site(true))
    edge.resolveForProxy.mockResolvedValue({ type: "entity", path: "/urun/bir-urun" })
    edge.checkBypass.mockResolvedValue("open")
    edge.backendFileResponse.mockImplementation(() =>
      Promise.resolve(new Response("User-agent: *\n", { status: 200 }))
    )
  })

  it("answers every page 503 with Retry-After and the platform's words", async () => {
    for (const path of ["/", "/urun/bir-urun", "/sepet", "/iletisim", "/onizleme/x"]) {
      const response = await visit(path)
      const html = await response.text()
      expect(response.status).toBe(503)
      expect(response.headers.get("retry-after")).toBe("3600")
      expect(response.headers.get("cache-control")).toBe("no-store")
      expect(html).toContain("Mağaza şu anda hizmet vermiyor")
      expect(html).toContain("Örnek Atölye")
      expect(html).not.toContain("Yenileniyoruz")
      expect(html).not.toContain("Yarın buradayız")
    }
  })

  it("ignores the maintenance bypass cookie: the shop cannot open it", async () => {
    const response = await visit("/", { cookie: `qt_bypass=${TOKEN}` })
    expect(response.status).toBe(503)
    expect(edge.checkBypass).not.toHaveBeenCalled()
  })

  it("keeps robots.txt and the sitemaps at 200", async () => {
    for (const path of ["/robots.txt", "/sitemap.xml", "/sitemap-products-1.xml"]) {
      expect((await visit(path)).status).toBe(200)
    }
    expect(edge.backendFileResponse).toHaveBeenCalledTimes(3)
  })

  it("darkens a page whose path only starts like a sitemap, and Next's other paths (L3)", async () => {
    for (const path of ["/sitemap-kampanya", "/sitemaps", "/_next/data/x.json"]) {
      expect((await visit(path)).status).toBe(503)
    }
    expect(edge.backendFileResponse).not.toHaveBeenCalled()
  })

  it("lets a card provider's return through, so a started payment settles", async () => {
    const response = await visit("/odeme/sonuc")
    expect(response.status).toBe(200)
  })

  it("serves a restricted (or active) shop as usual: the storefront only hears suspended", async () => {
    edge.edgeSite.mockResolvedValue({
      ...site(false),
      maintenance: { ...site(false).maintenance, enabled: false },
    })
    const response = await visit("/urun/bir-urun")
    expect(response.status).toBe(200)
    expect(response.headers.get("retry-after")).toBeNull()
  })
})
