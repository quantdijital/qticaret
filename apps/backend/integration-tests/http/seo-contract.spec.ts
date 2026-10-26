import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { CATALOG_ENTITY_TYPES } from "../../src/workflows/catalog/entity-paths"
import { upsertSeoMetaWorkflow } from "../../src/workflows/seo/upsert-seo-meta"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import type { HttpClient } from "../helpers/http"
import { doc, landingKit, words } from "../helpers/landings"
import type { LandingKit } from "../helpers/landings"

jest.setTimeout(240 * 1000)

const HOST = "https://magaza.example.com"
// Keys whose values are addresses in a JSON-LD block (schema.org)
const URL_KEYS = new Set(["url", "item", "@id", "image", "logo", "sameAs"])

interface Seo {
  title: string
  description: string
  canonical: string | null
  robots: string
  openGraph: {
    title: string
    description: string
    image: string | null
    type: string
    url: string | null
    siteName: string
  }
  twitter: { card: string; title: string; image: string | null }
  breadcrumbs: { name: string; url: string }[]
  jsonLd: Record<string, unknown>[]
  hreflang: unknown[]
}

const isAbsolute = (url: string) => url.startsWith(`${HOST}/`) || url.startsWith("https://")

// Every address a block carries, however deep
function addressesOf(value: unknown, key = ""): string[] {
  if (typeof value === "string") {
    return URL_KEYS.has(key) ? [value] : []
  }
  if (Array.isArray(value)) {
    return value.flatMap((each) => addressesOf(each, key))
  }
  if (value && typeof value === "object") {
    return Object.entries(value).flatMap(([inner, each]) => addressesOf(each, inner))
  }
  return []
}

/**
 * The `seo` payload's contract (docs/13 §1, F3 KK): every field there,
 * every address absolute on the canonical host, structured data with
 * its context and type, for each kind of page the storefront shows.
 */
function expectContract(seo: Seo | null | undefined, path: string) {
  expect(seo).toBeTruthy()
  if (!seo) {
    return
  }
  expect(seo.title.trim()).not.toBe("")
  expect(seo.description.trim()).not.toBe("")
  expect(seo.canonical).toBe(`${HOST}${path}`)
  expect(["index,follow", "noindex,follow", "noindex,nofollow"]).toContain(seo.robots)
  expect(seo.openGraph).toMatchObject({ url: seo.canonical })
  expect(seo.openGraph.title.trim()).not.toBe("")
  expect(seo.openGraph.siteName.trim()).not.toBe("")
  expect(["summary", "summary_large_image"]).toContain(seo.twitter.card)
  for (const image of [seo.openGraph.image, seo.twitter.image]) {
    expect(image === null || image.startsWith("https://")).toBe(true)
  }
  expect(seo.breadcrumbs.every((crumb) => isAbsolute(crumb.url) && crumb.name.trim())).toBe(true)
  expect(Array.isArray(seo.hreflang)).toBe(true)
  expect(seo.jsonLd.length).toBeGreaterThan(0)
  for (const block of seo.jsonLd) {
    expect(block["@context"]).toBe("https://schema.org")
    expect(typeof block["@type"]).toBe("string")
  }
  const relative = addressesOf(seo.jsonLd).filter((url) => !isAbsolute(url))
  expect(relative).toEqual([])
}

medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let kit: LandingKit
    const settings = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    beforeEach(async () => {
      kit = await landingKit(http, getContainer())
      await settings().saveSection("seo", { canonical_host: "magaza.example.com" }, null)
    })

    // The settings cache outlives the database reset between tests
    afterEach(async () => {
      await settings().saveSection("seo", { canonical_host: null }, null)
    })

    it("answers every kind of page with a full seo object, all its addresses absolute", async () => {
      const productId = await kit.product("sozlesme-kupa", { malzeme: "seramik" })
      const brand = await kit.post<{ brand: { id: string; handle: string } }>("/admin/brands", {
        name: "Sözleşme Markası",
        description: "Mutfak gereçleri üreten bir marka.",
      })
      await kit.post(`/admin/products/${productId}/brand`, { brand_id: brand.data.brand.id })
      const collection = await kit.post<{ collection: { id: string; handle: string } }>(
        "/admin/collections",
        { title: "Sözleşme Seçkisi" }
      )
      await kit.post(`/admin/collections/${collection.data.collection.id}/products`, {
        add: [productId],
      })
      // A listing's description is its own text (a collection has none in Medusa): the
      // shop writes one, and the advisor asks for it where it is missing
      await kit.post(`/admin/product-categories/${kit.categoryId}`, {
        description: "Evin her köşesi için gereçler.",
      })
      await upsertSeoMetaWorkflow(getContainer()).run({
        input: {
          entity_type: "collection",
          entity_id: collection.data.collection.id,
          values: { seo_description: "Yaz için seçtiğimiz ürünler." },
        },
      })
      const page = await kit.post<{ entry: { path: string } }>("/admin/content", {
        kind: "page",
        title: "Hakkımızda",
        status: "published",
        body: doc("Biz kimiz, ne yaparız ve neden yaparız."),
      })
      const article = await kit.post<{ entry: { path: string } }>("/admin/content", {
        kind: "post",
        title: "Kupa bakımı",
        status: "published",
        body: doc("Seramik kupalar elde yıkanır, bulaşık makinesinde de yıkanabilir."),
      })
      const landing = await kit.landing("seramik", {
        title: "Seramik kupalar",
        status: "published",
        body: doc(words("seramik", 320)),
      })

      const paths = {
        product: "/urun/sozlesme-kupa",
        category: "/kategori/ev-ve-yasam",
        brand: `/marka/${brand.data.brand.handle}`,
        collection: `/koleksiyon/${collection.data.collection.handle}`,
        page: page.data.entry.path,
        post: article.data.entry.path,
        landing: landing.data.landing.path ?? "",
      }
      for (const [kind, path] of Object.entries(paths)) {
        const answer = await kit.resolve(path)
        expect({ kind, type: answer.type, entity_type: answer.entity_type }).toMatchObject({
          kind,
          type: "entity",
          entity_type: CATALOG_ENTITY_TYPES[kind as keyof typeof CATALOG_ENTITY_TYPES],
        })
        try {
          expectContract(answer.seo as Seo | null | undefined, path)
        } catch (error) {
          throw new Error(`${kind} (${path}): ${(error as Error).message}`, { cause: error })
        }
      }
    })
  },
})
