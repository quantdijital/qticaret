import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from "../../src/modules/media"
import type MediaModuleService from "../../src/modules/media/service"
import type { TranscodeNextResult } from "../../src/workflows/media/video/transcode"
import { transcodeNextVideoWorkflow } from "../../src/workflows/media/video/transcode"
import { removeUnheldOutputs } from "../../src/workflows/media/video/transcode-steps"
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
  stored,
  storedFile,
  videoToolsPresent,
} from "../helpers/video"

jest.setTimeout(300 * 1000)

const clips = clipMaker()

/**
 * adr/0069 slice 2, security review M1 and M2: a ready video keeps its
 * public outputs whatever fails after it is written (the lock's release,
 * a later step), and a removal that races the job's `ready` leaves no
 * output in storage.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    let owner: { headers: Record<string, string> }
    let productId: string

    managedForThisFile()

    const media = () => getContainer().resolve<MediaModuleService>(MEDIA_MODULE)
    const publicFile = (name: string) =>
      storedFile(getContainer(), Buffer.from(name), "public", name)

    beforeEach(async () => {
      await setPlanLimits(getContainer(), {})
      owner = await createAdminUser(http, getContainer())
      const [product] = await getContainer()
        .resolve(Modules.PRODUCT)
        .createProducts([{ title: "Şef Bıçağı", handle: "sef-bicagi" }])
      productId = product?.id ?? ""
    })

    // A queue lock a case holds, let go after it whatever happened
    let afterRelease: (() => Promise<void>) | null = null

    afterEach(async () => {
      jest.restoreAllMocks()
      await afterRelease?.()
      afterRelease = null
    })

    afterAll(() => {
      clips.remove()
    })

    it("removes a failed run's outputs only when no ready record holds them (M1)", async () => {
      const files = [await publicFile("a.mp4"), await publicFile("a.jpg")]
      const video = await linkedVideo(getContainer(), productId, {
        status: "ready",
        output_file_ids: [files[0]],
        poster_file_ids: [files[1]],
      })
      expect(await removeUnheldOutputs(getContainer(), video.id, files)).toBe(false)
      for (const file of files) {
        expect(await stored(getContainer(), file)).toBe(true)
      }
      // Taken back to processing (the compensation's own first move): now they go
      await media().updateMediaVideos({ id: video.id, status: "processing" })
      expect(await removeUnheldOutputs(getContainer(), video.id, files)).toBe(true)
      for (const file of files) {
        expect(await stored(getContainer(), file)).toBe(false)
      }
    })

    it("leaves no output in storage when a removal races the job's ready (M2)", async () => {
      // The job stays out: this case plays its part
      const releaseQueue = await holdVideoQueueLock(getContainer())
      afterRelease = releaseQueue
      const source = await storedFile(getContainer(), Buffer.from("kaynak"))
      const video = await linkedVideo(getContainer(), productId, {
        source_file_id: source,
        source_bytes: 6,
      })
      const claimed = await media().claimNextVideo()
      expect(claimed?.id).toBe(video.id)
      const outputs = [await publicFile("v.mp4"), await publicFile("v.webm")]
      const poster = [await publicFile("v.jpg")]
      // The job writes ready between the removal's first read and its soft delete
      const service = media()
      const softDelete = service.softDeleteMediaVideos.bind(service)
      jest
        .spyOn(service, "softDeleteMediaVideos")
        .mockImplementation(async (...args: Parameters<typeof softDelete>) => {
          const written = await service.markVideoReady(video.id, 0, {
            width: 320,
            height: 240,
            duration_ms: 1000,
            outputs: { mp4: { url: "u", bytes: 5 } },
            output_file_ids: outputs,
            poster: { url: "p" },
            poster_file_ids: poster,
            stored_bytes: 21,
          })
          expect(written).toBe(true)
          return await softDelete(...args)
        })
      const removed = await settle(
        http.delete(`/admin/products/${productId}/videos/${video.id}`, { headers: owner.headers })
      )
      expect(removed.status).toBe(200)
      for (const file of [source, ...outputs, ...poster]) {
        expect(await stored(getContainer(), file)).toBe(false)
      }
      expect(await service.videoFiles(video.id)).toMatchObject({
        removed: true,
        source_file_id: null,
        output_file_ids: null,
        poster_file_ids: null,
      })
    })

    if (!videoToolsPresent) {
      return
    }

    it("keeps a ready video whole when letting the lock go fails (M1)", async () => {
      const bytes = clips.clip("kilit.mp4", [
        ...lavfi("testsrc=size=320x240:rate=10:duration=2"),
        ...["-c:v", "libx264", "-preset", "ultrafast", "-f", "mp4"],
      ])
      // Recorded while the job is held out, so this case's own run takes it
      const releaseQueue = await holdVideoQueueLock(getContainer())
      const source = await storedFile(getContainer(), bytes)
      const video = await linkedVideo(getContainer(), productId, {
        source_file_id: source,
        source_bytes: bytes.length,
      })
      await releaseQueue()
      // The store answers the release with an error (a Redis blip), after letting it go
      const locking = getContainer().resolve(Modules.LOCKING)
      const release = locking.release.bind(locking)
      const failing = jest
        .spyOn(locking, "release")
        .mockImplementation(async (...args: Parameters<typeof release>) => {
          await release(...args)
          throw new Error("ECONNRESET")
        })
      // The minute's job may hold the queue for a moment: run again while it is busy
      let result: TranscodeNextResult = { busy: true, video_id: null, status: null }
      for (let turn = 0; turn < 120 && result.busy; turn++) {
        result = (await transcodeNextVideoWorkflow(getContainer()).run({ input: { exclude: [] } }))
          .result
        if (result.busy) {
          await new Promise((resolve) => setTimeout(resolve, 500))
        }
      }
      expect(result).toEqual({ busy: false, video_id: video.id, status: "ready" })
      expect(failing).toHaveBeenCalled()
      const [row] = await media().listMediaVideos({ id: video.id })
      expect(row).toMatchObject({ status: "ready", source_file_id: null })
      for (const file of [...(row?.output_file_ids ?? []), ...(row?.poster_file_ids ?? [])]) {
        expect(await stored(getContainer(), file)).toBe(true)
      }
      expect(row?.output_file_ids).toHaveLength(2)
      expect(await stored(getContainer(), source)).toBe(false)
    })
  },
})
