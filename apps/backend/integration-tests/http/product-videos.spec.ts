import { spawnSync } from "node:child_process"
import { existsSync, mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { NO_LIMITS } from "../../src/modules/control-plane/types"
import { videoToolPaths } from "../../src/lib/media/video"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import { PRODUCT_VIDEOS } from "../../src/modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { sweepProductVideosWorkflow } from "../../src/workflows/media/video/workflows"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import { eventually } from "../helpers/eventually"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial, setPlanLimits, setPlanStatus } from "../helpers/plan-limits"
import { createStorefront } from "../helpers/storefront"
import { holdVideoQueueLock } from "../helpers/video"

jest.setTimeout(300 * 1000)

const MB = 1024 * 1024
const paths = videoToolPaths()
const answers = (command: string, args: string[]) =>
  spawnSync(command, args, { encoding: "utf8", timeout: 10_000 })
// The upload needs both programs and ffmpeg's encoders (lib/media/video/tools.ts)
const encoders = answers(paths.ffmpeg, ["-hide_banner", "-encoders"])
const tools =
  answers(paths.ffprobe, ["-version"]).status === 0 &&
  encoders.status === 0 &&
  encoders.stdout.includes(" libx264 ") &&
  encoders.stdout.includes(" libvpx-vp9 ")
if (!tools) {
  process.stderr.write(
    "ffprobe yok: video yükleme testleri yalnız 'kullanılamıyor' yolunu denetler\n"
  )
}

// Clips made here by ffmpeg: nothing binary is kept in the repository
const clips = mkdtempSync(join(tmpdir(), "qt-video-clips-"))
function clip(name: string, args: string[]): Buffer {
  const out = join(clips, name)
  const run = answers(paths.ffmpeg, ["-hide_banner", "-v", "error", "-y", ...args, out])
  if (run.status !== 0) {
    throw new Error(`ffmpeg failed: ${run.stderr}`)
  }
  return readFileSync(out)
}
const lavfi = (spec: string) => ["-f", "lavfi", "-i", spec]

// Upload directories this process leaves in the temp folder (lib/media/video/receive.ts)
// An upload's own: a directory holding its `source` (not the start's self-test, nor this file's clips)
const leftovers = () =>
  readdirSync(tmpdir()).filter(
    (name) =>
      name.startsWith("qt-video-") &&
      !name.startsWith("qt-video-clips-") &&
      existsSync(join(tmpdir(), name, "source"))
  )

interface VideoBody {
  video?: { id: string; status: string; kind: string; title: string | null; width: number }
  videos?: { id: string }[]
  upload?: boolean
  limit?: number
  message?: string
}

const form = (content: Buffer | string, name = "klip.mp4", type = "video/mp4", title?: string) => {
  const data = new FormData()
  if (title !== undefined) {
    data.append("title", title)
  }
  const bytes = typeof content === "string" ? content : new Uint8Array(content)
  data.append("file", new Blob([bytes], { type }), name)
  return data
}

/**
 * adr/0069 slice 1: a product's video uploaded (streamed, checked by its
 * bytes and by ffprobe, counted against storage), listed and removed;
 * refused by type, size, length, the two-per-product rule, the package's
 * storage, the role, the plan status and the flag. Clips are made by
 * ffmpeg here; without it only the "unavailable" path is checked.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let productId: string

    managedForThisFile()

    const url = () => `/admin/products/${productId}/videos`
    const upload = (data: FormData, headers = owner.headers) =>
      settle(http.post<VideoBody>(url(), data, { headers }))
    const list = () => settle(http.get<VideoBody>(url(), { headers: owner.headers }))
    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const flags = () =>
      getContainer().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)

    // The transcoding job (slice 2) is held still: these cases check the upload and the
    // record it leaves (`uploaded`, the source counted); product-video-transcode.spec.ts
    // checks what the job makes of it
    let releaseQueue: () => Promise<void> = () => Promise.resolve()

    afterEach(async () => {
      await releaseQueue()
    })

    beforeEach(async () => {
      releaseQueue = await holdVideoQueueLock(getContainer())
      await setPlanLimits(getContainer(), {})
      owner = await createAdminUser(http, getContainer())
      const [product] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Şef Bıçağı" }])
      productId = product?.id ?? ""
    })

    afterAll(() => {
      rmSync(clips, { recursive: true, force: true })
    })

    it("lists a product's videos with the limit and whether uploads are open", async () => {
      const answer = await list()
      expect(answer.status).toBe(200)
      expect(answer.data).toEqual({ videos: [], limit: 2, upload: tools })
      const missing = await settle(
        http.get<VideoBody>("/admin/products/prod_yok/videos", { headers: owner.headers })
      )
      expect(missing.status).toBe(404)
    })

    it("refuses a declared size past 52 MB before reading it", async () => {
      const refused = await upload(form(Buffer.alloc(53 * MB, 1)))
      expect(refused.status).toBe(413)
      expect(refused.data.message).toBe("video.too_large")
    })

    it("keeps uploads and removals to the catalog roles", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await upload(form("x"), operations.headers)).status).toBe(403)
      const removal = await settle(
        http.delete(`${url()}/mvid_01TEST`, { headers: operations.headers })
      )
      expect(removal.status).toBe(403)
    })

    it("closes uploads and removals in a restricted shop, and keeps the list readable", async () => {
      await setPlanStatus(getContainer(), "restricted")
      const restricted = await upload(form("x"))
      expect(restricted.status).toBe(403)
      expect(restricted.data.message).toBe("plan.restricted")
      const removal = await settle(
        http.delete<VideoBody>(`${url()}/mvid_01TEST`, { headers: owner.headers })
      )
      expect(removal.data.message).toBe("plan.restricted")
      expect((await list()).status).toBe(200)
    })

    // Review item 0: the flag reaches the shop only through the push route (its workflow
    // syncs the platform flags); a document stored directly leaves them as they were
    it("answers as if the routes did not exist while the flag is off, and alike for each", async () => {
      const pushFlag = async (on: boolean) => {
        const pushed = await settle(
          http.post(
            "/hooks/control-plane/plan",
            signed(
              doc(nextSerial(), {
                limits: { ...NO_LIMITS },
                platform_flags: { [PRODUCT_VIDEOS]: on },
              })
            )
          )
        )
        expect(pushed.status).toBe(200)
        expect(await flags().isFeatureEnabled(PRODUCT_VIDEOS)).toBe(on)
      }
      await pushFlag(false)
      const off = [
        await upload(form("x")),
        await list(),
        await settle(http.delete(`${url()}/mvid_01TEST`, { headers: owner.headers })),
      ]
      expect(off.map((answer) => answer.status)).toEqual([404, 404, 404])
      await pushFlag(true)
      expect((await list()).status).toBe(200)
    })

    /** A video record on the product as an upload leaves it, without the upload. */
    async function linkedVideo(product: string, fields: Record<string, unknown> = {}) {
      const video = await media().createMediaVideos({
        kind: "upload",
        source_format: "mp4",
        source_file_id: "video-kaynak-test.mp4",
        source_bytes: 1000,
        stored_bytes: 1000,
        uploaded_by: "user_01TEST",
        ...fields,
      })
      await getContainer()
        .resolve(ContainerRegistrationKeys.LINK)
        .create({
          [Modules.PRODUCT]: { product_id: product },
          [MEDIA_MODULE]: { media_video_id: video.id },
        })
      return video
    }

    it("never gives a video's storage key or uploader through `fields` (review D3)", async () => {
      await linkedVideo(productId)
      const readonly = await createAdminUser(http, getContainer(), "readonly")
      const admin = (fields: string, headers = readonly.headers) =>
        settle(
          http.get<{ product?: Record<string, unknown>; message?: string }>(
            `/admin/products/${productId}?fields=${encodeURIComponent(fields)}`,
            { headers }
          )
        )
      for (const fields of [
        "*media_videos",
        "+media_videos.*",
        "+media_videos.source_file_id",
        "+media_videos.uploaded_by",
        "+media_videos.output_file_ids",
      ]) {
        const answer = await admin(fields)
        expect(answer.status).toBe(400)
        expect(JSON.stringify(answer.data)).not.toMatch(/video-kaynak|user_01TEST/)
        expect((await admin(fields, owner.headers)).status).toBe(400)
      }
      const safe = await admin("id,+media_videos.id,+media_videos.status")
      expect(safe.status).toBe(200)
      expect(JSON.stringify(safe.data)).not.toMatch(/video-kaynak|user_01TEST/)
      const listed = await settle(
        http.get(`/admin/products?fields=${encodeURIComponent("*media_videos")}`, {
          headers: readonly.headers,
        })
      )
      expect(listed.status).toBe(400)

      // Review B-4: a wildcard, a shape the guard cannot read, an order or a filter on the link
      const raw = (query: string) =>
        settle(
          http.get<Record<string, unknown>>(`/admin/products/${productId}?${query}`, {
            headers: readonly.headers,
          })
        )
      const wildcard = await raw("fields=*")
      // Medusa's own answer to a bare wildcard (taken or refused), never a video's keys
      expect([200, 400]).toContain(wildcard.status)
      expect(JSON.stringify(wildcard.data)).not.toMatch(/media_video|video-kaynak|user_01TEST/)
      expect((await raw(`fields=${encodeURIComponent("*,*media_videos")}`)).status).toBe(400)
      expect((await raw("fields%5Bx%5D=media_videos")).status).toBe(400)
      for (const query of [
        "order=media_videos.source_file_id",
        `order=${encodeURIComponent("-media_videos.uploaded_by")}`,
        "media_videos%5Bsource_file_id%5D=video-kaynak-test.mp4",
      ]) {
        const answer = await settle(
          http.get<Record<string, unknown>>(`/admin/products?${query}`, {
            headers: readonly.headers,
          })
        )
        expect(JSON.stringify(answer.data)).not.toMatch(/video-kaynak|user_01TEST/)
      }

      // The storefront: its own leaves one by one (slice 4, store-product-videos.spec.ts),
      // never the relation whole or a key
      const { headers } = await createStorefront(getContainer())
      for (const fields of ["*media_videos", "+media_videos.source_file_id"]) {
        const answer = await settle(
          http.get(`/store/products?fields=${encodeURIComponent(fields)}`, { headers })
        )
        expect(answer.status).toBe(400)
        expect(JSON.stringify(answer.data)).not.toMatch(/video-kaynak|user_01TEST/)
      }
      const leaf = await settle(
        http.get(`/store/products?fields=${encodeURIComponent("+media_videos.id")}`, { headers })
      )
      expect(leaf.status).toBe(200)
      expect(JSON.stringify(leaf.data)).not.toMatch(/video-kaynak|user_01TEST/)
    })

    it("sweeps only videos without a product: a linked one a day old stays (review D5)", async () => {
      const kept = await linkedVideo(productId, { source_file_id: null })
      const orphan = await media().createMediaVideos({
        kind: "upload",
        source_format: "mp4",
        stored_bytes: 0,
      })
      const later = Date.now() + 2 * 24 * 60 * 60 * 1000
      const { result } = await sweepProductVideosWorkflow(getContainer()).run({
        input: { now: later },
      })
      expect(result.removed).toBe(1)
      const left = await media().listMediaVideos({ id: [kept.id, orphan.id] })
      expect(left.map((video) => video.id)).toEqual([kept.id])
      expect((await list()).data.videos?.map((video) => video.id)).toEqual([kept.id])
      // Today, nothing is old enough
      const now = await sweepProductVideosWorkflow(getContainer()).run({
        input: { now: Date.now() },
      })
      expect(now.result.removed).toBe(0)
    })

    interface AuditRow {
      action: string
      resource_type: string | null
      resource_id: string | null
      outcome: number | null
      changes: { diff?: Record<string, { before?: unknown; after?: unknown }> } | null
    }

    /**
     * A video's mutation entries. They are written once the answer has gone (adr/0011,
     * `audit/mutations.ts`), so they are read until `count` are there, as the other
     * audit suites do.
     */
    const auditOf = (id: string, count: number) =>
      eventually(
        async () =>
          (
            await http.get<{ audit_entries: AuditRow[] }>(
              `/admin/audit-log?resource_id=${id}&kind=mutation&limit=20`,
              { headers: owner.headers }
            )
          ).data.audit_entries,
        (entries) => entries.length >= count
      )

    // Without ffmpeg too: what needs no clip is checked before the tools are asked for
    it("refuses a third video and a full storage before the tools or the body", async () => {
      await linkedVideo(productId)
      await linkedVideo(productId)
      const third = await upload(form("x"))
      expect(third.status).toBe(400)
      expect(third.data.message).toBe("video.limit_per_product")

      const [other] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Ekmek Bıçağı" }])
      await setPlanLimits(getContainer(), { storage_mb: 0 })
      const full = await settle(
        http.post<VideoBody>(`/admin/products/${other?.id ?? ""}/videos`, form("x"), {
          headers: owner.headers,
        })
      )
      expect(full.status).toBe(403)
      expect(full.data.message).toBe("plan.limit_reached")
    })

    it("removes a video, records it, and keeps no storage key in the record", async () => {
      const video = await linkedVideo(productId, { title: "Yakın çekim" })
      const before = await media().storedBytes()
      const [other] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Ekmek Bıçağı" }])
      const elsewhere = await settle(
        http.delete(`/admin/products/${other?.id ?? ""}/videos/${video.id}`, {
          headers: owner.headers,
        })
      )
      expect(elsewhere.status).toBe(404)

      const removed = await settle(http.delete(`${url()}/${video.id}`, { headers: owner.headers }))
      expect(removed.status).toBe(200)
      expect(removed.data).toEqual({ id: video.id, object: "media_video", deleted: true })
      expect((await list()).data.videos).toEqual([])
      expect(await media().listMediaVideos({ id: video.id })).toEqual([])
      expect(await media().storedBytes()).toBe(before - 1000)
      expect(
        (await settle(http.delete(`${url()}/${video.id}`, { headers: owner.headers }))).status
      ).toBe(404)

      // Three removals named this video: on the other product (404), the one that took it
      // (200) and the one after (404). Each is recorded; the 200 is the one that changed it
      const entries = await auditOf(video.id, 3)
      expect(
        entries
          .filter((entry) => entry.action === "DELETE /admin/products/:id/videos/:video_id")
          .map((entry) => entry.outcome)
          .sort()
      ).toEqual([200, 404, 404])
      const removal = entries.find(
        (entry) =>
          entry.action === "DELETE /admin/products/:id/videos/:video_id" && entry.outcome === 200
      )
      expect(removal).toMatchObject({ resource_type: "media_video", resource_id: video.id })
      // What it was, before: its kind and title, never a file key or the uploader
      expect(removal?.changes?.diff?.[video.id]?.before).toEqual({
        kind: "upload",
        title: "Yakın çekim",
        youtube_id: null,
      })
      expect(JSON.stringify(entries)).not.toMatch(/video-kaynak|user_01TEST/)
    })

    if (!tools) {
      it("says uploads are unavailable without ffmpeg, and stores nothing", async () => {
        const refused = await upload(form("x"))
        expect(refused.status).toBe(503)
        expect(refused.data.message).toBe("video.upload_unavailable")
        expect(await media().listMediaVideos({})).toEqual([])
      })
      return
    }

    const small = () =>
      clip("ok.mp4", [...lavfi("testsrc=size=160x120:rate=10:duration=1"), "-c:v", "mpeg4"])

    it("stores a checked clip privately, waiting for its job, and counts it", async () => {
      const before = await media().storedBytes()
      const bytes = small()
      const stored = await upload(form(bytes, "IMG_0042.MOV", "video/quicktime", " Yakın çekim "))
      expect(stored.status).toBe(202)
      expect(stored.data.video).toMatchObject({
        kind: "upload",
        status: "uploaded",
        title: "Yakın çekim",
        width: 160,
      })
      expect(JSON.stringify(stored.data)).not.toMatch(/source_file_id|uploaded_by|video-kaynak/)
      expect(await media().storedBytes()).toBe(before + bytes.length)
      const [record] = await media().listMediaVideos({ id: stored.data.video?.id ?? "" })
      expect(record).toMatchObject({ source_format: "mp4", source_bytes: bytes.length })
      expect(record?.source_file_id).toMatch(/video-kaynak/)
      expect((await list()).data.videos).toHaveLength(1)
      expect(leftovers()).toEqual([])
    })

    it("takes two videos on a product, and refuses the third", async () => {
      expect((await upload(form(small()))).status).toBe(202)
      expect((await upload(form(small()))).status).toBe(202)
      const third = await upload(form(small()))
      expect(third.status).toBe(400)
      expect(third.data.message).toBe("video.limit_per_product")
      expect((await list()).data.videos).toHaveLength(2)
    })

    it.each([
      [
        "a PNG named .mp4",
        Buffer.from("89504e470d0a1a0a0000000d49484452", "hex"),
        "video.unsupported_type",
      ],
      [
        "an HLS playlist named .mp4",
        "#EXTM3U\n#EXTINF:1.0,\nconcat:/etc/passwd|/etc/hosts\n#EXT-X-ENDLIST\n",
        "video.unsupported_type",
      ],
      ["a concat: path", "concat:/etc/passwd|/etc/hosts", "video.unsupported_type"],
      [
        "a GIF, never taken as a video (adr/0069 Kararlar 11)",
        Buffer.from("GIF89a\x01\x00\x01\x00", "latin1"),
        "video.unsupported_type",
      ],
      ["an empty file", "", "video.unreadable"],
    ])("refuses %s, whatever it is called", async (_, content, code) => {
      const refused = await upload(form(content))
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe(code)
      expect(await media().listMediaVideos({})).toEqual([])
      expect(leftovers()).toEqual([])
    })

    it("refuses an AVI, 31 seconds and a side past 4096 px by ffprobe", async () => {
      const avi = clip("x.avi", [
        ...lavfi("testsrc=size=32x32:rate=5:duration=1"),
        "-c:v",
        "mpeg4",
        "-f",
        "avi",
      ])
      const long = clip("long.mp4", [
        ...lavfi("testsrc=size=32x32:rate=1:duration=31"),
        "-c:v",
        "mpeg4",
      ])
      const wide = clip("wide.mp4", [
        ...lavfi("color=size=4112x16:rate=1:duration=1"),
        "-c:v",
        "mpeg4",
      ])
      expect((await upload(form(avi))).data.message).toBe("video.unsupported_type")
      expect((await upload(form(long))).data.message).toBe("video.too_long")
      expect((await upload(form(wide))).data.message).toBe("video.dimensions_too_large")
      expect(await media().listMediaVideos({})).toEqual([])
    })

    it("cuts a body that passes 50 MB while it streams, and leaves no file behind", async () => {
      const refused = await upload(form(Buffer.alloc(51 * MB, 7)))
      expect(refused.status).toBe(400)
      expect(refused.data.message).toBe("video.too_large")
      expect(leftovers()).toEqual([])
      expect(await media().listMediaVideos({})).toEqual([])
    })

    it("refuses an upload past the package's storage, before storing it", async () => {
      await setPlanLimits(getContainer(), { storage_mb: 0 })
      const refused = await upload(form(small()))
      expect(refused.status).toBe(403)
      expect(refused.data.message).toBe("plan.limit_reached")
      expect(await media().listMediaVideos({})).toEqual([])
    })

    it("removes a video and its files at once; another product's video is not found", async () => {
      const before = await media().storedBytes()
      const stored = await upload(form(small()))
      const id = stored.data.video?.id ?? ""
      const [other] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Ekmek Bıçağı" }])
      const elsewhere = await settle(
        http.delete(`/admin/products/${other?.id ?? ""}/videos/${id}`, { headers: owner.headers })
      )
      expect(elsewhere.status).toBe(404)

      const removed = await settle(http.delete(`${url()}/${id}`, { headers: owner.headers }))
      expect(removed.status).toBe(200)
      expect(removed.data).toEqual({ id, object: "media_video", deleted: true })
      expect((await list()).data.videos).toEqual([])
      expect(await media().storedBytes()).toBe(before)
      const again = await settle(http.delete(`${url()}/${id}`, { headers: owner.headers }))
      expect(again.status).toBe(404)
    })

    it("records who added and removed a video, without its storage key", async () => {
      const stored = await upload(form(small()))
      const id = stored.data.video?.id ?? ""
      expect((await settle(http.delete(`${url()}/${id}`, { headers: owner.headers }))).status).toBe(
        200
      )
      // Written after each answer (adr/0011): read until both are there
      const actions = await auditOf(id, 2)
      expect(actions.map((entry) => entry.action).sort()).toEqual([
        "DELETE /admin/products/:id/videos/:video_id",
        "POST /admin/products/:id/videos",
      ])
      expect(JSON.stringify(actions)).not.toMatch(/video-kaynak|source_file_id/)
    })
  },
})
