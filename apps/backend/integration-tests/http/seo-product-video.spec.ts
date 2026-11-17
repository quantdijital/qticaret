import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
import { PRODUCT_VIDEOS } from "../../src/modules/platform-settings/features"
import { SEO_REDIRECTS_MODULE } from "../../src/modules/seo-redirects"
import type SeoRedirectsModuleService from "../../src/modules/seo-redirects/service"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial } from "../helpers/plan-limits"
import { createStorefront } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { holdVideoQueueLock, linkedVideo } from "../helpers/video"

jest.setTimeout(180 * 1000)

type Node = Record<string, unknown>

interface Answer {
  type: string
  seo?: { description: string; jsonLd: Node[] } | null
}

const PROCESSED = new Date("2026-11-17T09:30:00.000Z")

// A clip the job has made, as it leaves the record
const CLIP = {
  status: "ready",
  title: "Yakın çekim",
  position: 1,
  width: 720,
  height: 1280,
  duration_ms: 12_400,
  outputs: {
    mp4: { url: "https://dosya.ornek.com/sef-bicagi-video-1.mp4", bytes: 2_100_000 },
    webm: { url: "https://dosya.ornek.com/sef-bicagi-video-1.webm", bytes: 1_800_000 },
  },
  poster: {
    url: "https://dosya.ornek.com/sef-bicagi-video-1.jpg",
    width: 720,
    height: 1280,
    derivatives: {
      srcset: {
        webp: [
          { width: 400, url: "https://dosya.ornek.com/sef-bicagi-video-1-400.webp" },
          { width: 720, url: "https://dosya.ornek.com/sef-bicagi-video-1-720.webp" },
        ],
      },
      og: { url: "https://dosya.ornek.com/sef-bicagi-video-1-og.jpg", width: 1200, height: 630 },
    },
  },
  processed_at: PROCESSED,
}

const YOUTUBE = {
  kind: "youtube",
  source_format: null,
  status: "ready",
  title: null,
  position: 1,
  youtube_id: "dQw4w9WgXcQ",
  poster: { url: "https://dosya.ornek.com/sef-bicagi-video-2.jpg", width: 1280, height: 720 },
  processed_at: PROCESSED,
}

/**
 * adr/0069 slice 6: a product page's `seo` object carries a `VideoObject`
 * for each ready video, beside the product in one `@graph`; none while
 * `catalog.product_videos` is off, and none for a video still processing.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let admin: { headers: Record<string, string> }
    let store: Storefront

    managedForThisFile()

    const post = <T>(url: string, body: unknown) =>
      settle(http.post<T>(url, body, { headers: admin.headers }))
    const resolve = async (path: string) =>
      (
        await http.get<Answer>(`/store/seo/resolve?path=${encodeURIComponent(path)}`, {
          headers: store.headers,
        })
      ).data

    const pushFlag = async (on: boolean) => {
      const pushed = await settle(
        http.post(
          "/hooks/control-plane/plan",
          signed(
            doc(nextSerial(), {
              limits: Object.fromEntries(LIMIT_KEYS.map((key) => [key, null])) as PlanLimits,
              platform_flags: { [PRODUCT_VIDEOS]: on },
            })
          )
        )
      )
      expect(pushed.status).toBe(200)
    }

    // Each test its own handle: a resolve answer is kept per path for up to 30 seconds.
    // In a category of a category, as a shop's products are: the page has its breadcrumbs
    async function product(title: string): Promise<string> {
      const category = async (name: string, parent?: string) =>
        (
          await post<{ product_category: { id: string } }>("/admin/product-categories", {
            name,
            is_active: true,
            ...(parent ? { parent_category_id: parent } : {}),
          })
        ).data.product_category.id
      const kitchen = await category("Mutfak")
      const knives = await category("Bıçaklar", kitchen)
      const { data } = await post<{ product: { id: string } }>("/admin/products", {
        title,
        description: "<p>Dövme çelikten şef bıçağı.</p>",
        status: "published",
        categories: [{ id: knives }],
        options: [{ title: "Boy", values: ["20 cm"] }],
        variants: [
          {
            title: "20 cm",
            options: { Boy: "20 cm" },
            manage_inventory: false,
            prices: [{ currency_code: "try", amount: 1500 }],
          },
        ],
      })
      return data.product.id
    }

    const blocksOf = (answer: Answer) => answer.seo?.jsonLd ?? []
    const typed = (blocks: Node[], type: string) => blocks.find((block) => block["@type"] === type)
    const graphed = (blocks: Node[]) => blocks.find((block) => "@graph" in block)
    const forget = () =>
      getContainer()
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .invalidateResolutions()

    let releaseQueue: () => Promise<void> = () => Promise.resolve()

    beforeEach(async () => {
      releaseQueue = await holdVideoQueueLock(getContainer())
      admin = await createAdminUser(http, getContainer())
      store = await createStorefront(getContainer())
      await post("/admin/platform-settings/seo", { canonical_host: "magaza.example.com" })
    })

    // The settings cache outlives the database reset between tests: always set back
    afterEach(async () => {
      await post("/admin/platform-settings/seo", { canonical_host: null })
      await releaseQueue()
    })

    it("writes a VideoObject for each ready video, linked from the product", async () => {
      const id = await product("Şef Bıçağı Video")
      const clip = await linkedVideo(getContainer(), id, CLIP)
      const youtube = await linkedVideo(getContainer(), id, YOUTUBE)
      await linkedVideo(getContainer(), id, { ...CLIP, status: "processing", processed_at: null })

      const answer = await resolve("/urun/sef-bicagi-video")
      expect(answer.type).toBe("entity")
      // The page's own meta description describes its videos
      const description = answer.seo?.description ?? ""
      expect(description.length).toBeGreaterThan(0)
      // Every block a video-less page has is still there: the product (now a graph) and the trail
      const blocks = blocksOf(answer)
      expect(blocks).toHaveLength(2)
      expect(typed(blocks, "BreadcrumbList")).toBeDefined()
      const block = graphed(blocks)
      expect(block?.["@context"]).toBe("https://schema.org")
      const [productNode, ...videos] = (block?.["@graph"] ?? []) as Node[]
      const url = "https://magaza.example.com/urun/sef-bicagi-video"
      expect(productNode).toMatchObject({ "@type": "Product", name: "Şef Bıçağı Video" })
      expect(productNode).not.toHaveProperty("@context")
      const ids = [`${url}#video-${clip.id}`, `${url}#video-${youtube.id}`]
      expect((productNode?.["subjectOf"] as Node[]).map((link) => link["@id"]).sort()).toEqual(
        [...ids].sort()
      )
      expect(videos).toHaveLength(2)
      expect(videos.find((video) => video["@id"] === ids[0])).toEqual({
        "@type": "VideoObject",
        "@id": ids[0],
        name: "Yakın çekim",
        description,
        thumbnailUrl: [
          "https://dosya.ornek.com/sef-bicagi-video-1-720.webp",
          "https://dosya.ornek.com/sef-bicagi-video-1-og.jpg",
        ],
        uploadDate: "2026-11-17T09:30:00.000Z",
        duration: "PT12S",
        contentUrl: "https://dosya.ornek.com/sef-bicagi-video-1.mp4",
      })
      expect(videos.find((video) => video["@id"] === ids[1])).toEqual({
        "@type": "VideoObject",
        "@id": ids[1],
        name: "Şef Bıçağı Video",
        description,
        thumbnailUrl: ["https://dosya.ornek.com/sef-bicagi-video-2.jpg"],
        uploadDate: "2026-11-17T09:30:00.000Z",
        embedUrl: "https://www.youtube.com/embed/dQw4w9WgXcQ",
      })
    })

    it("drops a removed video once the cached answers are forgotten", async () => {
      const id = await product("Şef Bıçağı Kaldırma")
      const clip = await linkedVideo(getContainer(), id, CLIP)
      const youtube = await linkedVideo(getContainer(), id, YOUTUBE)
      const path = "/urun/sef-bicagi-kaldirma"
      const url = `https://magaza.example.com${path}`
      const remove = async (videoId: string) => {
        const removed = await settle(
          http.delete(`/admin/products/${id}/videos/${videoId}`, { headers: admin.headers })
        )
        expect(removed.status).toBe(200)
        await forget()
      }
      const both = graphed(blocksOf(await resolve(path)))
      expect(both?.["@graph"]).toHaveLength(3)

      await remove(clip.id)
      const one = graphed(blocksOf(await resolve(path)))
      const [productNode, ...videos] = (one?.["@graph"] ?? []) as Node[]
      expect(productNode?.["subjectOf"]).toEqual({ "@id": `${url}#video-${youtube.id}` })
      expect(videos.map((video) => video["@id"])).toEqual([`${url}#video-${youtube.id}`])

      // The last one gone: the product's block is as a video-less product's
      await remove(youtube.id)
      const blocks = blocksOf(await resolve(path))
      expect(graphed(blocks)).toBeUndefined()
      const plain = typed(blocks, "Product")
      expect(plain).toMatchObject({ "@context": "https://schema.org", name: "Şef Bıçağı Kaldırma" })
      expect(plain).not.toHaveProperty("subjectOf")
      expect(typed(blocks, "BreadcrumbList")).toBeDefined()
    })

    it("writes the product alone while the shop's videos are off", async () => {
      await pushFlag(false)
      try {
        const id = await product("Şef Bıçağı Kapalı")
        await linkedVideo(getContainer(), id, CLIP)
        const blocks = blocksOf(await resolve("/urun/sef-bicagi-kapali"))
        expect(graphed(blocks)).toBeUndefined()
        const plain = typed(blocks, "Product")
        expect(plain).toMatchObject({ "@context": "https://schema.org" })
        expect(plain).not.toHaveProperty("subjectOf")
        expect(typed(blocks, "BreadcrumbList")).toBeDefined()
      } finally {
        await pushFlag(true)
      }
    })
  },
})
