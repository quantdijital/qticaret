import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import sharp from "sharp"
import { LIMIT_KEYS } from "@qticaret/types/control-plane"
import type { PlanLimits } from "@qticaret/types/control-plane"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PRODUCT_VIDEOS } from "../../src/modules/platform-settings/features"
import { youtubeFetch } from "../../src/workflows/media/video/youtube-fetch"
import type { OembedAnswer } from "../../src/workflows/media/video/youtube-fetch"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial, setPlanLimits } from "../helpers/plan-limits"
import { linkedVideo, stored } from "../helpers/video"

jest.setTimeout(240 * 1000)

const ID = "dQw4w9WgXcQ"
const OTHER = "a_B-c9_-Z0x"

interface Video {
  id: string
  kind: string
  status: string
  title: string | null
  youtube_id: string | null
  duration_ms: number | null
  stored_bytes: number
  poster: { url: string; width: number; height: number } | null
  retryable: boolean
}

interface Answer {
  video?: Video
  videos?: Video[]
  message?: string
}

const cover = (width: number, height: number) =>
  sharp({ create: { width, height, channels: 3, background: { r: 30, g: 60, b: 90 } } })
    .jpeg()
    .toBuffer()

/**
 * adr/0069 slice 5: a product's YouTube video, by the link the shop pastes.
 * YouTube is a fake here (its oEmbed answer and its cover pictures, put in
 * place of the real fetch, as the address import's suite does): what is
 * asked of it is recorded, so a refused link is seen never to reach it.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    const real = { ...youtubeFetch }
    let owner: { headers: Record<string, string> }
    let productId: string
    let asked: string[]
    // The fake YouTube's answers, per test
    let oembed: (id: string) => Promise<OembedAnswer>
    let posters: Record<string, Buffer | null>

    managedForThisFile()

    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const url = () => `/admin/products/${productId}/videos`
    const add = (body: unknown, headers = owner.headers) =>
      settle(http.post<Answer>(`${url()}/youtube`, body, { headers }))
    const list = () => settle(http.get<Answer>(url(), { headers: owner.headers }))
    const recordOf = async (id: string) => (await media().listMediaVideos({ id }))[0]

    beforeEach(async () => {
      await setPlanLimits(getContainer(), {})
      owner = await createAdminUser(http, getContainer())
      const [product] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Bileme Taşı", handle: `bileme-tasi-${String(Date.now())}` }])
      productId = product?.id ?? ""
      asked = []
      const jpeg = await cover(1280, 720)
      oembed = () =>
        Promise.resolve({
          status: 200,
          body: Buffer.from(JSON.stringify({ type: "video", title: "Bıçak nasıl bilenir?" })),
        })
      posters = { maxresdefault: jpeg, hqdefault: jpeg }
      youtubeFetch.oembed = (id) => {
        asked.push(`oembed:${id}`)
        return oembed(id)
      }
      youtubeFetch.poster = (address) => {
        asked.push(address)
        const name = /\/([a-z]+)\.jpg$/.exec(address)?.[1] ?? ""
        return Promise.resolve(posters[name] ?? null)
      }
    })

    afterAll(() => {
      Object.assign(youtubeFetch, real)
    })

    it("adds a YouTube video ready at once, its cover copied and counted, the link not kept", async () => {
      const before = await media().storedBytes()
      const added = await add({ url: `https://youtu.be/${ID}?si=paylasim-izi&t=12` })
      expect(added.status).toBe(201)
      const video = added.data.video
      expect(video).toMatchObject({
        kind: "youtube",
        status: "ready",
        youtube_id: ID,
        // An empty title takes YouTube's
        title: "Bıçak nasıl bilenir?",
        duration_ms: null,
        retryable: false,
      })
      // YouTube was asked about the id alone; the largest cover was there
      expect(asked).toEqual([`oembed:${ID}`, `https://i.ytimg.com/vi/${ID}/maxresdefault.jpg`])
      const record = await recordOf(video?.id ?? "")
      expect(record?.processed_at).toBeTruthy()
      expect(record?.poster_file_ids?.length).toBeGreaterThan(1)
      for (const fileId of record?.poster_file_ids ?? []) {
        expect(await stored(getContainer(), fileId)).toBe(true)
      }
      expect(record?.poster).toMatchObject({ width: 1280, height: 720 })
      // Only the cover counts against storage
      expect(record?.stored_bytes).toBeGreaterThan(0)
      expect(await media().storedBytes()).toBe(before + (record?.stored_bytes ?? 0))
      // Nothing of the pasted address is kept anywhere on the record
      expect(JSON.stringify(record)).not.toMatch(/youtu\.be|paylasim-izi|si=/)
      expect((await list()).data.videos?.map((each) => each.id)).toEqual([video?.id])
    })

    it("keeps the shop's own title over YouTube's, and takes the cover YouTube has", async () => {
      posters = { maxresdefault: null, hqdefault: await cover(480, 360) }
      const added = await add({
        url: `https://www.youtube.com/watch?v=${OTHER}&t=4`,
        title: "  Bileme rehberi ",
      })
      expect(added.status).toBe(201)
      expect(added.data.video?.title).toBe("Bileme rehberi")
      expect(added.data.video?.poster).toMatchObject({ width: 480, height: 360 })
      expect(asked).toContain(`https://i.ytimg.com/vi/${OTHER}/hqdefault.jpg`)
    })

    it("refuses a link that is not a YouTube video's before asking YouTube anything", async () => {
      for (const link of [
        "javascript:alert(1)//youtube.com/watch?v=dQw4w9WgXcQ",
        "https://youtube.com.evil.com/watch?v=dQw4w9WgXcQ",
        "https://evilyoutube.com/watch?v=dQw4w9WgXcQ",
        "https://user@www.youtube.com/watch?v=dQw4w9WgXcQ",
        "https://www.youtube.com:8443/watch?v=dQw4w9WgXcQ",
        "http://169.254.169.254/latest/meta-data",
        "https://www.youtube.com/watch?v=short",
      ]) {
        const refused = await add({ url: link })
        expect([link, refused.status, refused.data.message]).toEqual([
          link,
          400,
          "video.youtube_invalid",
        ])
      }
      expect((await add({ url: `https://youtu.be/${ID}`, extra: 1 })).status).toBe(400)
      expect(asked).toEqual([])
      expect((await list()).data.videos).toEqual([])
    })

    it("refuses a video YouTube will not embed or does not show, and keeps nothing", async () => {
      for (const status of [401, 403, 404]) {
        oembed = () => Promise.resolve({ status, body: Buffer.from("Unauthorized") })
        const refused = await add({ url: `https://www.youtube.com/watch?v=${ID}` })
        expect([status, refused.status, refused.data.message]).toEqual([
          status,
          400,
          "video.youtube_unavailable",
        ])
      }
      oembed = () => Promise.resolve({ status: 503, body: Buffer.from("") })
      const down = await add({ url: `https://www.youtube.com/watch?v=${ID}` })
      expect(down.data.message).toBe("video.youtube_unreachable")
      // No cover was fetched for a refused video
      expect(asked.filter((each) => each.startsWith("https://"))).toEqual([])
      expect(await media().listMediaVideos({})).toEqual([])
    })

    it("opens the record without a cover when YouTube has none to give", async () => {
      posters = { maxresdefault: null, hqdefault: Buffer.from("not a picture at all") }
      const added = await add({ url: `https://www.youtube.com/shorts/${ID}` })
      expect(added.status).toBe(201)
      expect(added.data.video).toMatchObject({ kind: "youtube", status: "ready", poster: null })
      const record = await recordOf(added.data.video?.id ?? "")
      expect(record?.stored_bytes).toBe(0)
      expect(record?.poster_file_ids ?? []).toEqual([])
    })

    it("counts uploads and YouTube links together: two at most", async () => {
      await linkedVideo(getContainer(), productId, { status: "ready", stored_bytes: 1000 })
      const second = await add({ url: `https://www.youtube.com/embed/${ID}` })
      expect(second.status).toBe(201)
      const third = await add({ url: `https://www.youtube-nocookie.com/embed/${OTHER}` })
      expect(third.status).toBe(400)
      expect(third.data.message).toBe("video.limit_per_product")
      expect((await list()).data.videos).toHaveLength(2)
      // The full product was refused before YouTube was asked about the third
      expect(asked.filter((each) => each === `oembed:${OTHER}`)).toEqual([])
    })

    it("keeps adding to the catalog roles, and answers 404 while videos are off", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await add({ url: `https://youtu.be/${ID}` }, operations.headers)).status).toBe(403)

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
      await pushFlag(false)
      expect((await add({ url: `https://youtu.be/${ID}` })).status).toBe(404)
      await pushFlag(true)
      expect(asked).toEqual([])
    })

    it("removes a YouTube video with its cover's files, and records it with its id", async () => {
      const added = await add({ url: `https://youtu.be/${ID}` })
      const id = added.data.video?.id ?? ""
      const files = (await recordOf(id))?.poster_file_ids ?? []
      expect(files.length).toBeGreaterThan(0)
      const before = await media().storedBytes()

      const removed = await settle(http.delete(`${url()}/${id}`, { headers: owner.headers }))
      expect(removed.status).toBe(200)
      for (const fileId of files) {
        expect(await stored(getContainer(), fileId)).toBe(false)
      }
      expect(await media().storedBytes()).toBeLessThan(before)
      expect((await list()).data.videos).toEqual([])

      const entries = await eventually(
        async () =>
          (
            await http.get<{
              audit_entries: {
                action: string
                outcome: number
                changes: { diff?: Record<string, { before?: unknown; after?: unknown }> } | null
              }[]
            }>(`/admin/audit-log?resource_id=${id}&kind=mutation&limit=20`, {
              headers: owner.headers,
            })
          ).data.audit_entries,
        (rows) => rows.length >= 2
      )
      const addition = entries.find(
        (entry) => entry.action === "POST /admin/products/:id/videos/youtube"
      )
      expect(addition?.outcome).toBe(201)
      expect(addition?.changes?.diff?.[id]?.after).toEqual({
        kind: "youtube",
        title: "Bıçak nasıl bilenir?",
        youtube_id: ID,
      })
      const removal = entries.find(
        (entry) => entry.action === "DELETE /admin/products/:id/videos/:video_id"
      )
      expect(removal?.changes?.diff?.[id]?.before).toMatchObject({ youtube_id: ID })
      // No storage key in the audit
      expect(JSON.stringify(entries)).not.toMatch(/\.jpg|\.webp|poster_file_ids/)
    })

    it("refuses a link while the package's storage is full, before asking YouTube", async () => {
      await setPlanLimits(getContainer(), { storage_mb: 0 })
      const full = await add({ url: `https://youtu.be/${ID}` })
      expect(full.status).toBe(403)
      expect(full.data.message).toBe("plan.limit_reached")
      expect(asked).toEqual([])
    })
  },
})
