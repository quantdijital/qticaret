import { beforeEach, describe, expect, it, vi } from "vitest"

const state = vi.hoisted(() => ({ headers: new Headers({ "x-qt-url": "/koleksiyon/yaz" }) }))
const requests = vi.hoisted(() => ({ resolvePath: vi.fn(), storefrontSettings: vi.fn() }))

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

const params = { params: Promise.resolve({ path: ["koleksiyon", "yaz"] }) }

const SEO = {
  title: "Yaz Seçkisi",
  description: "Yaz.",
  canonical: "https://magaza.example/koleksiyon/yaz",
  robots: "index,follow",
  openGraph: null,
  twitter: null,
  breadcrumbs: [],
  jsonLd: [],
  hreflang: [],
}

/**
 * `catalog.collections` off: the backend answers a collection's address
 * as not found; a resolve answer cached across the change still gets the
 * not-found page's noindex.
 */
describe("a collection's address while collections are off", () => {
  beforeEach(() => {
    vi.clearAllMocks()
    requests.storefrontSettings.mockResolvedValue({
      features: { gift_cards: false, product_addons: false, collections: false },
    })
  })

  it("is a 404 with noindex when the backend says not found", async () => {
    requests.resolvePath.mockResolvedValue({ type: "not_found", path: null })
    await expect(CatchAllPage(params)).rejects.toThrow("NEXT_NOT_FOUND")
    expect((await generateMetadata(params)).robots).toBe("noindex,follow")
  })

  it("is noindex even for a collection page resolve still names", async () => {
    requests.resolvePath.mockResolvedValue({
      type: "entity",
      path: "/koleksiyon/yaz",
      entity_type: "product_collection",
      entity_id: "pcol_1",
      seo: SEO,
    })
    const metadata = await generateMetadata(params)
    expect(metadata.robots).toBe("noindex,follow")
    // The not-found page's title, not the collection's
    expect(JSON.stringify(metadata.title)).not.toContain("Yaz Seçkisi")
  })
})
