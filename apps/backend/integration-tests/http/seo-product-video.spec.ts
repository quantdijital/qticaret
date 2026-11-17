import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
import { PRODUCT_VIDEOS } from "../../src/modules/platform-settings/features"
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

    // Each test its own handle: a resolve answer is kept per path for up to 30 seconds
    async function product(title: string): Promise<string> {
      const { data } = await post<{ product: { id: string } }>("/admin/products", {
        title,
        description: "<p>Dövme çelikten şef bıçağı.</p>",
        status: "published",
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
      const [block, crumbs] = answer.seo?.jsonLd ?? []
      expect(crumbs).toMatchObject({ "@type": "BreadcrumbList" })
      expect(block?.["@context"]).toBe("https://schema.org")
      const [productNode, ...videos] = (block?.["@graph"] ?? []) as Node[]
      const url = "https://magaza.example.com/urun/sef-bicagi-video"
      expect(productNode).toMatchObject({ "@type": "Product", name: "Şef Bıçağı Video" })
      expect(productNode).not.toHaveProperty("@context")
      const ids = [`${url}#video-${clip.id}`, `${url}#video-${youtube.id}`]
      expect((productNode?.["subjectOf"] as Node[]).map((link) => link["@id"]).sort()).toEqual(
        [...ids].sort()
      )
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

    it("writes the product alone while the shop's videos are off", async () => {
      await pushFlag(false)
      try {
        const id = await product("Şef Bıçağı Kapalı")
        await linkedVideo(getContainer(), id, CLIP)
        const answer = await resolve("/urun/sef-bicagi-kapali")
        const [block] = answer.seo?.jsonLd ?? []
        expect(block).toMatchObject({ "@context": "https://schema.org", "@type": "Product" })
        expect(block).not.toHaveProperty("@graph")
        expect(block).not.toHaveProperty("subjectOf")
      } finally {
        await pushFlag(true)
      }
    })
  },
})
