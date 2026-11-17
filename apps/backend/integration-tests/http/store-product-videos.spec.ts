import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
import { STORE_VIDEO_LEAVES } from "../../src/api/http/media-routes"
import { PRODUCT_VIDEOS } from "../../src/modules/platform-settings/features"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial } from "../helpers/plan-limits"
import { createStorefront, createTestProduct } from "../helpers/storefront"
import type { Storefront } from "../helpers/storefront"
import { holdVideoQueueLock, linkedVideo } from "../helpers/video"

jest.setTimeout(180 * 1000)

type Row = Record<string, unknown>

const LEAVES = STORE_VIDEO_LEAVES.join(",")

// A clip the job has made: its public outputs and poster, its private bookkeeping
const READY = {
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
  output_file_ids: ["sef-bicagi-video-1-01J.mp4", "sef-bicagi-video-1-01J.webm"],
  poster: {
    url: "https://dosya.ornek.com/sef-bicagi-video-1.jpg",
    width: 720,
    height: 1280,
    derivatives: {
      srcset: {
        webp: [{ width: 400, url: "https://dosya.ornek.com/sef-bicagi-video-1-400.webp" }],
      },
      og: null,
    },
  },
  poster_file_ids: ["sef-bicagi-video-1-01J.jpg"],
  stored_bytes: 4_000_000,
  processed_at: new Date(),
  uploaded_by: "user_01JPERSONEL",
}

// Nothing of these leaves the Store API, whatever is asked
const PRIVATE = [
  "source_file_id",
  "source_bytes",
  "source_format",
  "output_file_ids",
  "poster_file_ids",
  "stored_bytes",
  "error_code",
  "attempts",
  "retry_from",
  "failed_at",
  "heartbeat_at",
  "uploaded_by",
]

/**
 * adr/0069 slice 4: the storefront reads a product's videos through the
 * Store API's own leaves, one by one; only the ready ones come out, none
 * while `catalog.product_videos` is off, and a draft's preview reads them
 * alike. Storage keys, file ids, the uploader and the job's bookkeeping
 * never leave.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let store: Storefront
    let owner: { headers: Record<string, string> }
    let productId: string

    managedForThisFile()

    const page = (id: string, fields: string) =>
      settle(
        http.get<{ product: Row; message?: string }>(
          `/store/products/${id}?fields=${encodeURIComponent(fields)}`,
          { headers: store.headers }
        )
      )

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

    // The job stays out: the records here are written as it would leave them
    let releaseQueue: () => Promise<void> = () => Promise.resolve()

    beforeEach(async () => {
      releaseQueue = await holdVideoQueueLock(getContainer())
      store = await createStorefront(getContainer())
      owner = await createAdminUser(http, getContainer())
      const variantId = await createTestProduct(getContainer(), store.salesChannelId, {
        handle: "sef-bicagi",
        price: 1000,
      })
      const [variant] = await getContainer()
        .resolve(Modules.PRODUCT)
        .listProductVariants({ id: variantId }, { select: ["product_id"] })
      productId = variant?.product_id ?? ""
    })

    afterEach(async () => {
      await releaseQueue()
    })

    it("gives the storefront the ready videos' public leaves, and nothing of their bookkeeping", async () => {
      const ready = await linkedVideo(getContainer(), productId, READY)
      await linkedVideo(getContainer(), productId, {
        status: "processing",
        source_file_id: "video-kaynak-01J.mp4",
        source_bytes: 1000,
        attempts: 1,
        heartbeat_at: new Date(),
        uploaded_by: "user_01JPERSONEL",
      })
      await linkedVideo(getContainer(), productId, {
        status: "failed",
        source_file_id: "video-kaynak-01K.mp4",
        error_code: "video.processing_failed",
        failed_at: new Date(),
      })

      const answer = await page(productId, `id,title,${LEAVES}`)
      expect(answer.status).toBe(200)
      const videos = answer.data.product["media_videos"] as Row[]
      expect(videos).toHaveLength(1)
      expect(videos[0]).toMatchObject({
        id: ready.id,
        kind: "upload",
        status: "ready",
        title: "Yakın çekim",
        position: 1,
        width: 720,
        height: 1280,
        duration_ms: 12_400,
        outputs: READY.outputs,
        poster: READY.poster,
        youtube_id: null,
      })
      for (const field of PRIVATE) {
        expect(videos[0]).not.toHaveProperty(field)
      }
      const text = JSON.stringify(answer.data)
      expect(text).not.toMatch(/01J\.(mp4|webm|jpg)|video-kaynak|user_01JPERSONEL/)

      // A list answers alike, `+` leaves added to the defaults
      const listed = await settle(
        http.get<{ products: Row[] }>(
          `/store/products?handle=sef-bicagi&fields=${encodeURIComponent(
            STORE_VIDEO_LEAVES.map((leaf) => `+${leaf}`).join(",")
          )}`,
          { headers: store.headers }
        )
      )
      expect(listed.status).toBe(200)
      expect(
        (listed.data.products[0]?.["media_videos"] as Row[]).map((video) => video["id"])
      ).toEqual([ready.id])
    })

    it.each([
      "id,*media_videos",
      "id,media_videos",
      "id,media_videos.*",
      "id,+media_videos.source_file_id",
      "id,+media_videos.output_file_ids",
      "id,+media_videos.poster_file_ids",
      "id,+media_videos.error_code",
      "id,+media_videos.uploaded_by",
      "id,+media_videos.attempts",
      "id,+media_videos.heartbeat_at",
      "id,variants.product.media_videos.id",
    ])("refuses %s", async (fields) => {
      await linkedVideo(getContainer(), productId, READY)
      const answer = await page(productId, fields)
      expect(answer.status).toBe(400)
      expect(JSON.stringify(answer.data)).not.toMatch(/01J|user_01JPERSONEL/)
    })

    it("answers without videos while the flag is off, and with them once it is on again", async () => {
      const ready = await linkedVideo(getContainer(), productId, READY)
      await pushFlag(false)
      const off = await page(productId, `id,title,${LEAVES}`)
      expect(off.status).toBe(200)
      expect(off.data.product).not.toHaveProperty("media_videos")
      expect(off.data.product["title"]).toBe("sef-bicagi")

      await pushFlag(true)
      const on = await page(productId, `id,${LEAVES}`)
      expect((on.data.product["media_videos"] as Row[]).map((video) => video["id"])).toEqual([
        ready.id,
      ])
    })

    it("reads a draft's videos in its preview as the Store API does", async () => {
      const [draft] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Ekmek Bıçağı" }])
      const draftId = draft?.id ?? ""
      const ready = await linkedVideo(getContainer(), draftId, READY)
      await linkedVideo(getContainer(), draftId, { status: "uploaded", source_file_id: "k.mp4" })
      const preview = async () => {
        const link = await settle(
          http.post<{ path: string }>(`/admin/products/${draftId}/preview`, {}, owner)
        )
        const token = link.data.path.split("/").at(-1) ?? ""
        return settle(
          http.get<{ product: Row }>(`/store/product-preview/${token}`, { headers: store.headers })
        )
      }

      const shown = await preview()
      expect(shown.status).toBe(200)
      const videos = shown.data.product["media_videos"] as Row[]
      expect(videos.map((video) => video["id"])).toEqual([ready.id])
      for (const field of PRIVATE) {
        expect(videos[0]).not.toHaveProperty(field)
      }

      await pushFlag(false)
      const off = await preview()
      expect(off.status).toBe(200)
      expect(off.data.product).not.toHaveProperty("media_videos")
      await pushFlag(true)
    })
  },
})
