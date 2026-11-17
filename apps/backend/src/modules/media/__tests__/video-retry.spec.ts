import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from ".."
import type MediaModuleService from "../service"
import type { RetriedVideo } from "../video-retry"

jest.setTimeout(120 * 1000)

const CODE = "video.processing_failed"
const DAY_MS = 24 * 60 * 60 * 1000
// Failed an hour ago
const FAILED_AT = new Date(Date.now() - 60 * 60 * 1000)

function retriedOf(value: RetriedVideo | null): RetriedVideo {
  if (!value) {
    throw new Error("expected a retried video")
  }
  return value
}

/**
 * "Yeniden dene" (adr/0069 §10, slice 3) as one statement: only the
 * infrastructure's failure with its source kept, `attempts` never lowered
 * (it fences a job's claim), the cap counted from `retry_from`.
 */
moduleIntegrationTestRunner<MediaModuleService>({
  moduleName: MEDIA_MODULE,
  resolve: "./src/modules/media",
  testSuite: ({ service }) => {
    const failed = (name: string, fields: Record<string, unknown> = {}) =>
      service.createMediaVideos({
        kind: "upload",
        status: "failed",
        error_code: CODE,
        source_file_id: `video-kaynak-${name}.mov`,
        source_bytes: 1000,
        source_format: "mov",
        stored_bytes: 1000,
        failed_at: FAILED_AT,
        ...fields,
      })

    it("retries only the infrastructure's failure while its source is kept", async () => {
      const since = new Date(Date.now() - DAY_MS)
      const input = await failed("r2", { error_code: "video.too_long" })
      const swept = await failed("r3", { source_file_id: null })
      const ready = await failed("r4", { status: "ready", error_code: null })
      const untimed = await failed("r5", { failed_at: null })
      for (const video of [input, swept, ready, untimed]) {
        expect(await service.retryVideo(video.id, CODE, since)).toBeNull()
      }
      // Failed before `since`, whatever changed it later: the sweep may be taking its source
      const video = await failed("r1", { attempts: 3, title: "Yeni başlık" })
      expect(await service.retryVideo(video.id, CODE, new Date(Date.now()))).toBeNull()
    })

    it("keeps the tries, counts from them, and is undone only while no job took it", async () => {
      const since = new Date(Date.now() - DAY_MS)
      const video = await failed("r1", { attempts: 3 })
      const retried = retriedOf(await service.retryVideo(video.id, CODE, since))
      expect(retried).toMatchObject({ attempts: 3, previous_retry_from: 0 })
      expect(new Date(retried.previous_failed_at ?? 0)).toEqual(FAILED_AT)
      expect((await service.listMediaVideos({ id: video.id }))[0]).toMatchObject({
        status: "uploaded",
        attempts: 3,
        retry_from: 3,
        error_code: null,
        failed_at: null,
      })
      expect(await service.retryVideo(video.id, CODE, since)).toBeNull()

      // Undone while it waits: failed again as it was
      expect(await service.unretryVideo(video.id, CODE, retried)).toBe(true)
      expect((await service.listMediaVideos({ id: video.id }))[0]).toMatchObject({
        status: "failed",
        attempts: 3,
        retry_from: 0,
        error_code: CODE,
        failed_at: FAILED_AT,
      })
      // Taken by the job meanwhile: left to it
      const again = retriedOf(await service.retryVideo(video.id, CODE, since))
      expect((await service.claimNextVideo())?.id).toBe(video.id)
      expect(await service.unretryVideo(video.id, CODE, again)).toBe(false)
    })

    it("writes failed_at only on a move into failed (review S1)", async () => {
      const video = await failed("t1", { status: "uploaded", error_code: null, failed_at: null })
      expect((await service.claimNextVideo())?.id).toBe(video.id)
      await service.markVideoTried(video.id, 0, { status: "failed", attempts: 1, error_code: CODE })
      const [row] = await service.listMediaVideos({ id: video.id })
      expect(row?.failed_at).not.toBeNull()
      // A title change leaves it
      await service.updateMediaVideos({ id: video.id, title: "Yakın çekim" })
      expect((await service.listMediaVideos({ id: video.id }))[0]?.failed_at).toEqual(
        row?.failed_at
      )
    })

    it("lets the sweep release a source only while the record is still as it read it", async () => {
      const week = new Date(Date.now() - 7 * DAY_MS)
      const old = await failed("s1", { failed_at: new Date(Date.now() - 8 * DAY_MS) })
      // Retried after the sweep read it: no longer failed, the source stays named
      await service.updateMediaVideos({ id: old.id, status: "uploaded", failed_at: null })
      expect(await service.releaseFailedSource(old.id, "video-kaynak-s1.mov", week)).toBe(false)
      // Failed again just now: not a week old
      await service.updateMediaVideos({ id: old.id, status: "failed", failed_at: new Date() })
      expect(await service.releaseFailedSource(old.id, "video-kaynak-s1.mov", week)).toBe(false)
      // A week old with another source than the one read: left alone
      await service.updateMediaVideos({ id: old.id, failed_at: new Date(Date.now() - 8 * DAY_MS) })
      expect(await service.releaseFailedSource(old.id, "video-kaynak-x.mov", week)).toBe(false)
      expect(await service.releaseFailedSource(old.id, "video-kaynak-s1.mov", week)).toBe(true)
      expect((await service.listMediaVideos({ id: old.id }))[0]).toMatchObject({
        source_file_id: null,
        stored_bytes: 0,
      })

      // A ready clip's left-over source: only once it has been ready a while
      const ready = await failed("s2", {
        status: "ready",
        error_code: null,
        processed_at: new Date(),
      })
      const hourAgo = new Date(Date.now() - 60 * 60 * 1000)
      expect(await service.releaseReadySource(ready.id, "video-kaynak-s2.mov", hourAgo)).toBe(false)
      await service.updateMediaVideos({ id: ready.id, processed_at: new Date(Date.now() - DAY_MS) })
      expect(await service.releaseReadySource(ready.id, "video-kaynak-s2.mov", hourAgo)).toBe(true)
    })
  },
})
