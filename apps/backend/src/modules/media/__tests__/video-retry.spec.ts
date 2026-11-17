import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from ".."
import type MediaModuleService from "../service"
import type { RetriedVideo } from "../video-retry"

jest.setTimeout(120 * 1000)

const CODE = "video.processing_failed"

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
        ...fields,
      })

    it("retries only the infrastructure's failure while its source is kept", async () => {
      const since = new Date(Date.now() - 60_000)
      const input = await failed("r2", { error_code: "video.too_long" })
      const swept = await failed("r3", { source_file_id: null })
      const ready = await failed("r4", { status: "ready", error_code: null })
      for (const video of [input, swept, ready]) {
        expect(await service.retryVideo(video.id, CODE, since)).toBeNull()
      }
      // Changed before `since`: the sweep may be taking its source now
      const video = await failed("r1", { attempts: 3 })
      expect(await service.retryVideo(video.id, CODE, new Date(Date.now() + 60_000))).toBeNull()
    })

    it("keeps the tries, counts from them, and is undone only while no job took it", async () => {
      const since = new Date(Date.now() - 60_000)
      const video = await failed("r1", { attempts: 3 })
      const retried = retriedOf(await service.retryVideo(video.id, CODE, since))
      expect(retried).toEqual({ attempts: 3, previous_retry_from: 0 })
      expect((await service.listMediaVideos({ id: video.id }))[0]).toMatchObject({
        status: "uploaded",
        attempts: 3,
        retry_from: 3,
        error_code: null,
      })
      expect(await service.retryVideo(video.id, CODE, since)).toBeNull()

      // Undone while it waits: failed again as it was
      expect(await service.unretryVideo(video.id, CODE, retried)).toBe(true)
      expect((await service.listMediaVideos({ id: video.id }))[0]).toMatchObject({
        status: "failed",
        attempts: 3,
        retry_from: 0,
        error_code: CODE,
      })
      // Taken by the job meanwhile: left to it
      const again = retriedOf(await service.retryVideo(video.id, CODE, since))
      expect((await service.claimNextVideo())?.id).toBe(video.id)
      expect(await service.unretryVideo(video.id, CODE, again)).toBe(false)
    })
  },
})
