import { spawnSync } from "node:child_process"
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs"
import { tmpdir } from "node:os"
import { join } from "node:path"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { videoToolPaths } from "../../src/lib/media/video"
import { CONTROL_PLANE_MODULE } from "../../src/modules/control-plane"
import type ControlPlaneModuleService from "../../src/modules/control-plane/service"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import { createAdminUser } from "../helpers/admin"
import { doc, managedForThisFile, signed } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { nextSerial, setPlanLimits, setPlanStatus } from "../helpers/plan-limits"

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
const leftovers = () =>
  readdirSync(tmpdir()).filter(
    (name) => name.startsWith("qt-video-") && !name.startsWith("qt-video-clips-")
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

    beforeEach(async () => {
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

    it("keeps uploads to the catalog roles, an open plan and the flag", async () => {
      const operations = await createAdminUser(http, getContainer(), "operations")
      expect((await upload(form("x"), operations.headers)).status).toBe(403)

      await setPlanStatus(getContainer(), "restricted")
      const restricted = await upload(form("x"))
      expect(restricted.status).toBe(403)
      expect(restricted.data.message).toBe("plan.restricted")
      await setPlanLimits(getContainer(), {})

      await getContainer()
        .resolve<ControlPlaneModuleService>(CONTROL_PLANE_MODULE)
        .storePlanDocument(
          signed(doc(nextSerial(), { platform_flags: { "catalog.product_videos": false } })),
          "push"
        )
      expect((await upload(form("x"))).status).toBe(404)
      expect((await list()).status).toBe(404)
      await setPlanLimits(getContainer(), {})
      expect((await list()).status).toBe(200)
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
        "a GIF (slice 7)",
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
      await settle(http.delete(`${url()}/${id}`, { headers: owner.headers }))
      const log = await settle(
        http.get<{
          audit_entries: { action: string; resource_id: string | null; changes: unknown }[]
        }>("/admin/audit-log?limit=20", { headers: owner.headers })
      )
      const actions = log.data.audit_entries.filter((entry) => entry.resource_id === id)
      expect(actions.map((entry) => entry.action).sort()).toEqual([
        "DELETE /admin/products/:id/videos/:video_id",
        "POST /admin/products/:id/videos",
      ])
      expect(JSON.stringify(actions)).not.toMatch(/video-kaynak|source_file_id/)
    })
  },
})
