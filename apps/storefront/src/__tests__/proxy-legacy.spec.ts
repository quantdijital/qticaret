import { NextRequest } from "next/server"
import { beforeEach, describe, expect, it, vi } from "vitest"
import type { Resolution } from "@qticaret/types"
import type * as Env from "@/lib/env"

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

const visit = (path: string) => proxy(new NextRequest(`http://localhost:8000${path}`))

const redirect = (location: string, status = 301): Resolution =>
  ({ type: "redirect", path: "", status, location }) as Resolution

/**
 * The proxy and an old platform's addresses (adr/0059, docs/13 §4): one
 * hop from an unclean old address to its page, the home page and the
 * storefront's lists resolved only for an old platform's query, and no
 * 404 reported for a page that renders anyway.
 */
describe("the proxy with old addresses", () => {
  beforeEach(() => {
    vi.clearAllMocks()
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

  it("sends an old address with a trailing slash straight to its page, in one hop", async () => {
    edge.resolveForProxy.mockResolvedValue(redirect("/kategori/mutfak/tavalar?sayfa=2"))
    const response = await visit("/mutfak/tavalar/page/2/")
    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe(
      "http://localhost:8000/kategori/mutfak/tavalar?sayfa=2"
    )
    // The clean form was asked, its query kept
    expect(edge.resolveForProxy).toHaveBeenCalledWith("/mutfak/tavalar/page/2", null)
  })

  it("sends an old file's address in another case straight to the moved file", async () => {
    edge.resolveForProxy.mockResolvedValue(redirect("https://cdn.example.com/media/tava.webp"))
    const response = await visit("/wp-content/uploads/2026/01/Tava.PNG")
    expect(response.headers.get("location")).toBe("https://cdn.example.com/media/tava.webp")
    expect(edge.resolveForProxy).toHaveBeenCalledWith("/wp-content/uploads/2026/01/tava.png", null)
  })

  it("still normalises an address resolve does not send on", async () => {
    const response = await visit("/Hakkimizda/?utm_source=x")
    expect(response.status).toBe(301)
    expect(response.headers.get("location")).toBe("http://localhost:8000/hakkimizda?utm_source=x")
  })

  it("asks resolve about the home page and a list only for an old platform's query", async () => {
    await visit("/")
    await visit("/?utm_source=x")
    await visit("/blog?sayfa=2")
    await visit("/magaza?marka=demirci")
    expect(edge.resolveForProxy).not.toHaveBeenCalled()

    edge.resolveForProxy.mockResolvedValue(redirect("/blog/tava-bakimi"))
    const record = await visit("/?p=40")
    expect(record.status).toBe(301)
    expect(record.headers.get("location")).toBe("http://localhost:8000/blog/tava-bakimi")
    edge.resolveForProxy.mockResolvedValue(redirect("/blog?sayfa=2"))
    const page = await visit("/blog?paged=2")
    expect(page.headers.get("location")).toBe("http://localhost:8000/blog?sayfa=2")
    expect(edge.resolveForProxy).toHaveBeenCalledTimes(2)
  })

  it("answers 410 for an old address that is gone", async () => {
    edge.resolveForProxy.mockResolvedValue({ type: "gone", path: "/wp-login.php" })
    const response = await visit("/wp-login.php")
    expect(response.status).toBe(410)
  })

  it("reports no 404 for the home page or a list, whatever their query", async () => {
    await visit("/?p=999999")
    await visit("/magaza?paged=4")
    expect(edge.reportNotFound).not.toHaveBeenCalled()
    await visit("/hic-olmayan")
    expect(edge.reportNotFound).toHaveBeenCalledWith("/hic-olmayan", null, null)
  })
})
