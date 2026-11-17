import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { MEDIA_MODULE } from ".."
import type MediaModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<MediaModuleService>({
  moduleName: MEDIA_MODULE,
  resolve: "./src/modules/media",
  testSuite: ({ service }) => {
    it("keeps an image's master, size and alt text, one row per URL", async () => {
      const asset = await service.createMediaAssets({
        file_id: "kupa-01J.jpg",
        url: "https://cdn.example.com/kupa-01J.jpg",
        width: 1600,
        height: 1200,
        alt: "Beyaz seramik kupa",
      })
      expect(asset.id).toMatch(/^media_/)

      const [found] = await service.listMediaAssets({ url: asset.url })
      expect(found).toMatchObject({ width: 1600, alt: "Beyaz seramik kupa", derivatives: null })

      await expect(
        service.createMediaAssets({ url: asset.url, file_id: "other.jpg" })
      ).rejects.toThrow()

      // Gone, its URL can be uploaded again
      await service.softDeleteMediaAssets([asset.id])
      await expect(service.createMediaAssets({ url: asset.url })).resolves.toMatchObject({
        url: asset.url,
      })
    })

    it("opens a video waiting for its job and counts every file it holds (adr/0069)", async () => {
      const before = await service.storedBytes()
      await service.createMediaAssets({
        file_id: "tabak-01J.jpg",
        url: "https://cdn.example.com/tabak-01J.jpg",
        size: 1000,
      })
      const video = await service.createMediaVideos({
        kind: "upload",
        source_file_id: "video-kaynak-01J.mov",
        source_bytes: 5_000_000,
        source_format: "mov",
        stored_bytes: 5_000_000,
      })
      expect(video.id).toMatch(/^mvid_/)
      expect(video).toMatchObject({ status: "uploaded", position: 1, attempts: 0 })
      expect(await service.storedBytes()).toBe(before + 1000 + 5_000_000)

      // Processed: the source goes, the outputs and the poster count instead
      await service.updateMediaVideos({
        id: video.id,
        source_file_id: null,
        stored_bytes: 1_200_000,
      })
      expect(await service.storedBytes()).toBe(before + 1000 + 1_200_000)

      // Removed: nothing of it counts
      await service.softDeleteMediaVideos([video.id])
      expect(await service.storedBytes()).toBe(before + 1000)
      await expect(
        service.createMediaVideos({ kind: "vimeo" as "upload", stored_bytes: 0 })
      ).rejects.toThrow()
    })

    it("finds removed videos whose files are still named, until they are forgotten (D4)", async () => {
      const video = await service.createMediaVideos({
        kind: "upload",
        source_file_id: "video-kaynak-02J.mp4",
        output_file_ids: ["cikti-02J.mp4"],
        stored_bytes: 3000,
      })
      // Live: not the sweep's
      expect((await service.videosWithFilesLeft()).map((row) => row.id)).not.toContain(video.id)
      await service.softDeleteMediaVideos([video.id])
      expect(await service.videosWithFilesLeft()).toContainEqual({
        id: video.id,
        source_file_id: "video-kaynak-02J.mp4",
        output_file_ids: ["cikti-02J.mp4"],
        poster_file_ids: null,
      })
      await service.forgetVideoFiles(video.id)
      expect((await service.videosWithFilesLeft()).map((row) => row.id)).not.toContain(video.id)

      // Undone removal: the record comes back as it was
      const again = await service.createMediaVideos({ kind: "upload", stored_bytes: 10 })
      await service.softDeleteMediaVideos([again.id])
      await service.restoreMediaVideos([again.id])
      expect(await service.listMediaVideos({ id: again.id })).toHaveLength(1)
    })

    const waiting = (name: string, fields: Record<string, unknown> = {}) =>
      service.createMediaVideos({
        kind: "upload",
        source_file_id: `video-kaynak-${name}.mov`,
        source_bytes: 1000,
        source_format: "mov",
        stored_bytes: 1000,
        ...fields,
      })

    it("hands the job the oldest waiting clip once, and none it already tried (adr/0069 §4)", async () => {
      const first = await waiting("q1")
      const second = await waiting("q2")
      await service.createMediaVideos({
        kind: "youtube",
        youtube_id: "dQw4w9WgXcQ",
        status: "ready",
      })
      const removed = await waiting("q3")
      await service.softDeleteMediaVideos([removed.id])

      const claimed = await service.claimNextVideo()
      expect(claimed).toEqual({
        id: first.id,
        source_file_id: "video-kaynak-q1.mov",
        source_format: "mov",
        source_bytes: 1000,
        attempts: 0,
      })
      const [row] = await service.listMediaVideos({ id: first.id })
      expect(row?.status).toBe("processing")
      expect(row?.heartbeat_at).not.toBeNull()

      expect((await service.claimNextVideo([second.id]))?.id).toBeUndefined()
      expect((await service.claimNextVideo())?.id).toBe(second.id)
      expect(await service.claimNextVideo()).toBeNull()
    })

    it("writes ready only while the job holds the video, and can take it back", async () => {
      const video = await waiting("r1")
      await service.claimNextVideo()
      expect(await service.beatVideo(video.id)).toBe(true)
      const ready = {
        width: 1280,
        height: 720,
        duration_ms: 12_000,
        outputs: { mp4: { url: "https://cdn.example.com/a.mp4", bytes: 400 } },
        output_file_ids: ["a.mp4", "a.webm"],
        poster: { url: "https://cdn.example.com/a.jpg", width: 1280, height: 720 },
        poster_file_ids: ["a.jpg"],
        stored_bytes: 1600,
      }
      expect(await service.markVideoReady(video.id, ready)).toBe(true)
      const [done] = await service.listMediaVideos({ id: video.id })
      expect(done).toMatchObject({
        status: "ready",
        width: 1280,
        output_file_ids: ["a.mp4", "a.webm"],
        poster_file_ids: ["a.jpg"],
        stored_bytes: 1600,
        heartbeat_at: null,
      })
      expect(done?.processed_at).not.toBeNull()
      // Not the job's any more: no heartbeat, no second write
      expect(await service.beatVideo(video.id)).toBe(false)
      expect(await service.markVideoReady(video.id, ready)).toBe(false)

      // Taken back (a later step failed): processing, its outputs forgotten, the source counted
      await service.unmarkVideoReady(video.id)
      const [back] = await service.listMediaVideos({ id: video.id })
      expect(back).toMatchObject({
        status: "processing",
        outputs: null,
        output_file_ids: null,
        stored_bytes: 1000,
      })

      // Ready again, then its source is gone: no longer named nor counted
      await service.markVideoReady(video.id, ready)
      await service.forgetVideoSource(video.id)
      const [clean] = await service.listMediaVideos({ id: video.id })
      expect(clean).toMatchObject({ source_file_id: null, stored_bytes: 600 })

      // A video removed while it was processed is not written
      const gone = await waiting("r2")
      await service.claimNextVideo()
      await service.softDeleteMediaVideos([gone.id])
      expect(await service.beatVideo(gone.id)).toBe(false)
      expect(await service.markVideoReady(gone.id, ready)).toBe(false)
      expect(
        await service.markVideoTried(gone.id, { status: "failed", attempts: 1, error_code: "x" })
      ).toBe(false)
    })

    it("puts a silent job's clip back with a try counted, and fails it past three", async () => {
      const video = await waiting("s1", { attempts: 1 })
      const tired = await waiting("s2", { attempts: 2 })
      await service.claimNextVideo()
      await service.claimNextVideo()
      // Still beating: left alone
      expect(await service.requeueStaleVideos(new Date(Date.now() - 60_000), 3, "f")).toEqual([])

      const later = new Date(Date.now() + 60_000)
      const moved = await service.requeueStaleVideos(later, 3, "video.processing_failed")
      expect(moved.sort((a, b) => a.id.localeCompare(b.id))).toEqual(
        [
          { id: video.id, status: "uploaded" },
          { id: tired.id, status: "failed" },
        ].sort((a, b) => a.id.localeCompare(b.id))
      )
      const rows = await service.listMediaVideos({ id: [video.id, tired.id] })
      expect(rows.find((row) => row.id === video.id)).toMatchObject({
        status: "uploaded",
        attempts: 2,
        error_code: null,
        heartbeat_at: null,
      })
      expect(rows.find((row) => row.id === tired.id)).toMatchObject({
        status: "failed",
        attempts: 3,
        error_code: "video.processing_failed",
      })

      // A failed try written by the job itself
      await service.claimNextVideo()
      expect(
        await service.markVideoTried(video.id, {
          status: "failed",
          attempts: 3,
          error_code: "video.unreadable",
        })
      ).toBe(true)
      const [failed] = await service.listMediaVideos({ id: video.id })
      expect(failed).toMatchObject({ status: "failed", error_code: "video.unreadable" })
      // The source of a failed clip is kept (a week, for "Yeniden dene")
      expect(failed?.source_file_id).toBe("video-kaynak-s1.mov")
    })
  },
})
