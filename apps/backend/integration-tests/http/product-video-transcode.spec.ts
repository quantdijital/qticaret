import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import mediaVideoQueue from "../../src/jobs/media-video-queue"
import { STRUCTURAL_TAGS, encodeActivity, resetEncodeActivity } from "../../src/lib/media/video"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import type { MediaVideoRecord } from "../../src/modules/media/service"
import {
  runVideoQueue,
  transcodeNextVideoWorkflow,
} from "../../src/workflows/media/video/transcode"
import { sweepProductVideosWorkflow } from "../../src/workflows/media/video/workflows"
import { createAdminUser } from "../helpers/admin"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { settle } from "../helpers/http"
import { setPlanLimits } from "../helpers/plan-limits"
import {
  clipMaker,
  holdVideoQueueLock,
  lavfi,
  linkedVideo,
  probeStored,
  stored,
  storedFile,
  videoToolsPresent,
} from "../helpers/video"

jest.setTimeout(600 * 1000)

if (!videoToolsPresent) {
  process.stderr.write("ffmpeg yok: video dönüştürme testleri yalnız kuyruk kurallarını denetler\n")
}

const clips = clipMaker()
const MINUTE = 60 * 1000

/** Waits (polling) until `done` holds, up to `ms`: a clip takes seconds to make. */
async function until<T>(look: () => Promise<T>, done: (value: T) => boolean, ms = 3 * MINUTE) {
  const end = Date.now() + ms
  let value = await look()
  while (!done(value) && Date.now() < end) {
    await new Promise((resolve) => setTimeout(resolve, 250))
    value = await look()
  }
  return value
}

/**
 * adr/0069 slice 2: an uploaded clip made into MP4, WebM and a poster with
 * no sound and no tags, its source removed; one clip at a time; a silent
 * job's clip put back; a broken clip failed at once; a ready video's files
 * removed with it and a left-over source by the nightly sweep.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let productId: string

    managedForThisFile()

    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const url = () => `/admin/products/${productId}/videos`
    const record = async (id: string): Promise<MediaVideoRecord | undefined> =>
      (await media().listMediaVideos({ id }))[0]
    const settled = (id: string) =>
      until(
        () => record(id),
        (video) => video?.status === "ready" || video?.status === "failed"
      )

    const upload = async (content: Buffer, name = "IMG_0042.MOV") => {
      const data = new FormData()
      data.append("file", new Blob([new Uint8Array(content)], { type: "video/quicktime" }), name)
      const answer = await settle(
        http.post<{ video?: { id: string } }>(url(), data, { headers: owner.headers })
      )
      expect(answer.status).toBe(202)
      return answer.data.video?.id ?? ""
    }

    const privateFile = (bytes: Buffer) => storedFile(getContainer(), bytes)
    const linked = (fields: Record<string, unknown>) =>
      linkedVideo(getContainer(), productId, fields)

    beforeEach(async () => {
      await setPlanLimits(getContainer(), {})
      owner = await createAdminUser(http, getContainer())
      const [product] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Şef Bıçağı", handle: "sef-bicagi" }])
      productId = product?.id ?? ""
    })

    afterAll(() => {
      clips.remove()
    })

    it("puts a silent job's clip back in the queue with a try counted", async () => {
      const release = await holdVideoQueueLock(getContainer())
      try {
        const video = await linked({ source_file_id: "video-kaynak-x.mp4", source_bytes: 10 })
        await media().claimNextVideo()
        // Its process was killed eleven minutes ago: no heartbeat since
        await getContainer()
          .resolve(ContainerRegistrationKeys.PG_CONNECTION)
          .raw("UPDATE media_video SET heartbeat_at = now() - interval '11 minutes' WHERE id = ?", [
            video.id,
          ])
        await mediaVideoQueue(getContainer())
        expect(await record(video.id)).toMatchObject({ status: "uploaded", attempts: 1 })
      } finally {
        await release()
      }
    })

    it("removes a ready clip's left-over source in the nightly sweep", async () => {
      const source = await privateFile(Buffer.from("kaynak"))
      const video = await linked({ status: "ready", source_file_id: source, source_bytes: 6 })
      await media().updateMediaVideos({ id: video.id, stored_bytes: 106 })
      const { result } = await sweepProductVideosWorkflow(getContainer()).run({
        input: { now: Date.now() },
      })
      expect(result.sources_removed).toBe(1)
      expect(await stored(getContainer(), source)).toBe(false)
      expect(await record(video.id)).toMatchObject({ source_file_id: null, stored_bytes: 100 })
    })

    if (!videoToolsPresent) {
      return
    }

    it("makes a 30 s MOV with a place and sound into MP4, WebM and a poster without either", async () => {
      const mov = clips.clip("telefon.mov", [
        ...lavfi("testsrc2=size=1280x720:rate=30:duration=30"),
        ...lavfi("sine=frequency=440:duration=30"),
        ...["-c:v", "libx264", "-preset", "veryfast", "-crf", "30", "-c:a", "aac"],
        ...["-metadata", "location=+41.0082+028.9784/", "-metadata", "creation_time=2026-11-01"],
        ...["-metadata", "com.apple.quicktime.location.ISO6709=+41.0082+028.9784/"],
        ...["-movflags", "use_metadata_tags", "-f", "mov"],
      ])
      const before = await media().storedBytes()
      const started = Date.now()
      const id = await upload(mov)
      const video = await settled(id)
      process.stderr.write(
        `30 sn 720p MOV, yüklemeden hazıra: ${String(Date.now() - started)} ms\n`
      )
      expect(video).toMatchObject({
        status: "ready",
        width: 1280,
        height: 720,
        source_file_id: null,
        error_code: null,
      })
      const outputs = video?.outputs as { mp4: { url: string }; webm: { url: string } }
      expect(outputs.mp4.url).toMatch(/sef-bicagi-video-1\.mp4$/)
      expect(outputs.webm.url).toMatch(/sef-bicagi-video-1\.webm$/)
      const poster = video?.poster as { url: string; derivatives: { srcset: { webp: unknown[] } } }
      expect(poster.url).toMatch(/sef-bicagi-video-1\.jpg$/)
      expect(JSON.stringify(poster.derivatives)).toMatch(/sef-bicagi-video-1-400\.webp/)

      for (const fileId of video?.output_file_ids ?? []) {
        const read = await probeStored(getContainer(), fileId, clips.dir)
        expect(read.streams.map((stream) => stream.codec_type)).toEqual(["video"])
        const tags = [
          ...Object.keys(read.format.tags ?? {}),
          ...read.streams.flatMap((stream) => Object.keys(stream.tags ?? {})),
        ]
        expect(tags.filter((tag) => !STRUCTURAL_TAGS.has(tag))).toEqual([])
        expect(JSON.stringify(read)).not.toMatch(/41\.0082|2026-11-01|location/i)
        expect(Number(read.format.duration)).toBeLessThanOrEqual(30.1)
      }
      // Counted: its outputs and poster, no longer the source
      expect(video?.stored_bytes).toBeGreaterThan(0)
      expect(await media().storedBytes()).toBe(before + (video?.stored_bytes ?? 0))

      // Removed from the panel: every file goes with it
      const files = [...(video?.output_file_ids ?? []), ...(video?.poster_file_ids ?? [])]
      expect(files.length).toBeGreaterThanOrEqual(5)
      const removed = await settle(http.delete(`${url()}/${id}`, { headers: owner.headers }))
      expect(removed.status).toBe(200)
      for (const fileId of files) {
        expect(await stored(getContainer(), fileId)).toBe(false)
      }
      expect(await media().storedBytes()).toBe(before)
    })

    it("makes two uploads one after another, never two ffmpeg processes at once", async () => {
      const release = await holdVideoQueueLock(getContainer())
      const short = (size: string) =>
        clips.clip(`kisa-${size}.mp4`, [
          ...lavfi(`testsrc=size=${size}:rate=15:duration=3`),
          ...["-c:v", "libx264", "-preset", "ultrafast", "-f", "mp4"],
        ])
      const ids = [await upload(short("640x360")), await upload(short("360x640"))]
      await release()
      resetEncodeActivity()
      await Promise.all([
        runVideoQueue(getContainer()),
        transcodeNextVideoWorkflow(getContainer()).run({ input: { exclude: [] } }),
        mediaVideoQueue(getContainer()),
      ])
      const done = await Promise.all(ids.map(settled))
      expect(done.map((video) => video?.status)).toEqual(["ready", "ready"])
      expect(done.map((video) => [video?.width, video?.height])).toEqual([
        [640, 360],
        [360, 640],
      ])
      expect(encodeActivity().peak).toBe(1)
    })

    it("fails a broken clip at once and keeps its source for a retry", async () => {
      const source = await privateFile(
        Buffer.concat([Buffer.from("0000001866747970", "hex"), Buffer.from("isom0000isomavc1junk")])
      )
      const video = await linked({ source_file_id: source, source_bytes: 28 })
      await runVideoQueue(getContainer())
      const done = await settled(video.id)
      expect(done).toMatchObject({
        status: "failed",
        attempts: 1,
        error_code: "video.unreadable",
        source_file_id: source,
      })
      expect(await stored(getContainer(), source)).toBe(true)
    })

    it("takes a killed job's clip again and finishes it", async () => {
      const release = await holdVideoQueueLock(getContainer())
      const id = await upload(
        clips.clip("tekrar.mp4", [
          ...lavfi("testsrc=size=320x240:rate=10:duration=2"),
          ...["-c:v", "libx264", "-preset", "ultrafast", "-f", "mp4"],
        ])
      )
      await media().claimNextVideo()
      await getContainer()
        .resolve(ContainerRegistrationKeys.PG_CONNECTION)
        .raw("UPDATE media_video SET heartbeat_at = now() - interval '11 minutes' WHERE id = ?", [
          id,
        ])
      await release()
      await mediaVideoQueue(getContainer())
      expect(await settled(id)).toMatchObject({ status: "ready", attempts: 1 })
    })
  },
})
