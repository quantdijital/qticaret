import type { Resolution, SeoPayload } from "@qticaret/types"
import { beforeEach, describe, expect, it, vi } from "vitest"

const HOST = "magaza.example"
const SHOP = "My L'arte"
const state = vi.hoisted(() => ({ url: "/", resolution: null as Resolution | null }))

vi.mock("next/headers", () => ({
  headers: () => Promise.resolve(new Headers({ "x-qt-url": state.url })),
}))
vi.mock("@/lib/store-api/requests", async (importOriginal) => ({
  ...(await importOriginal<object>()),
  resolvePath: () => Promise.resolve(state.resolution),
  siteSeo: () => Promise.resolve({ shop: { name: SHOP }, canonical_host: HOST, indexing: true }),
}))

const entity = await import("../[...path]/page")
const shop = await import("../magaza/page")
const blog = await import("../blog/page")
const reviews = await import("../yorumlar/page")

// The catch-all's own segments: any address but Next's (`/_next/...` is a 404 of its own)
const entityParams = { params: Promise.resolve({ path: ["liste"] }) }

const seoOf = (title: string, canonical: string): SeoPayload => ({
  title,
  description: "Açıklama.",
  canonical,
  robots: "index,follow",
  openGraph: {
    title,
    description: "Açıklama.",
    image: null,
    imageAlt: null,
    type: "website",
    url: canonical,
    siteName: SHOP,
  },
  twitter: { card: "summary", title, description: "Açıklama.", image: null },
  breadcrumbs: [],
  jsonLd: [],
  hreflang: [],
})

function resolved(path: string, rest: Partial<Extract<Resolution, { type: "entity" }>>): void {
  state.resolution = { type: "entity", path, entity_id: "x", entity_type: "post", ...rest }
}

const query = (search: Record<string, string>) => ({ searchParams: Promise.resolve(search) })

// docs/13 §3: every paginated list names its later pages, the shop's name last
describe("a paginated list's metadata", () => {
  beforeEach(() => {
    state.url = "/"
    state.resolution = null
  })

  it("titles a category's later page; resolve's canonical stays", async () => {
    const path = "/kategori/kupalar"
    state.url = `${path}?sayfa=2`
    resolved(path, {
      entity_type: "product_category",
      seo: seoOf(`Kupalar Modelleri ve Fiyatları | ${SHOP}`, `https://${HOST}${path}?sayfa=2`),
      listing: { filters: {}, price: null, sort: null, page: 2, page_size: 24 },
    })
    const metadata = await entity.generateMetadata(entityParams)
    expect(metadata.title).toEqual({
      absolute: `Kupalar Modelleri ve Fiyatları – Sayfa 2 | ${SHOP}`,
    })
    expect(metadata.alternates?.canonical).toBe(`https://${HOST}${path}?sayfa=2`)
    expect(metadata.description).toBe("Açıklama.")
  })

  it("leaves a listing's first page as resolve wrote it", async () => {
    const path = "/kampanyalar"
    state.url = path
    resolved(path, {
      entity_type: "sale",
      seo: seoOf(`Kampanyalar | ${SHOP}`, `https://${HOST}${path}`),
      listing: { filters: {}, price: null, sort: null, page: 1, page_size: 24 },
    })
    expect((await entity.generateMetadata(entityParams)).title).toEqual({
      absolute: `Kampanyalar | ${SHOP}`,
    })
  })

  it("titles an author's later page and names it canonical", async () => {
    const path = "/blog/yazar/deniz"
    state.url = `${path}?sayfa=3`
    resolved(path, {
      entity_type: "post_author",
      seo: seoOf(`Deniz | ${SHOP}`, `https://${HOST}${path}`),
    })
    const metadata = await entity.generateMetadata(entityParams)
    expect(metadata.title).toEqual({ absolute: `Deniz – Sayfa 3 | ${SHOP}` })
    expect(metadata.alternates?.canonical).toBe(`https://${HOST}${path}?sayfa=3`)
    expect(metadata.openGraph?.url).toBe(`https://${HOST}${path}?sayfa=3`)
  })

  it("titles a blog archive's later page", async () => {
    const path = "/blog/etiket/celik"
    state.url = `${path}?sayfa=2`
    resolved(path, {
      entity_type: "post_tag",
      seo: seoOf(`Çelik | ${SHOP}`, `https://${HOST}${path}`),
    })
    expect((await entity.generateMetadata(entityParams)).title).toEqual({
      absolute: `Çelik – Sayfa 2 | ${SHOP}`,
    })
  })

  it("titles /magaza's later page, its own canonical", async () => {
    const second = await shop.generateMetadata(query({ sayfa: "2" }))
    expect(second.title).toEqual({ absolute: `Tüm ürünler – Sayfa 2 | ${SHOP}` })
    expect(second.alternates?.canonical).toBe(`https://${HOST}/magaza?sayfa=2`)
    const first = await shop.generateMetadata(query({}))
    expect(first.title).toEqual({ absolute: `Tüm ürünler | ${SHOP}` })
    expect(first.alternates?.canonical).toBe(`https://${HOST}/magaza`)
  })

  it("titles /blog's later page, its own canonical", async () => {
    const second = await blog.generateMetadata(query({ sayfa: "4" }))
    expect(second.title).toEqual({ absolute: `Blog – Sayfa 4 | ${SHOP}` })
    expect(second.alternates?.canonical).toBe(`https://${HOST}/blog?sayfa=4`)
    expect((await blog.generateMetadata(query({}))).title).toEqual({ absolute: `Blog | ${SHOP}` })
  })

  it("titles /yorumlar's later page, its own canonical", async () => {
    const second = await reviews.generateMetadata(query({ sayfa: "2" }))
    expect(second.title).toEqual({ absolute: `Müşteri yorumları – Sayfa 2 | ${SHOP}` })
    expect(second.alternates?.canonical).toBe(`https://${HOST}/yorumlar?sayfa=2`)
  })
})
