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
      await service.forgetVideoFiles(video.id, ["video-kaynak-02J.mp4", "cikti-02J.mp4"])
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

    it("forgets only the files storage took from a removed video (review M2)", async () => {
      const video = await service.createMediaVideos({
        kind: "upload",
        source_file_id: "kaynak-m2.mov",
        output_file_ids: ["o1.mp4", "o2.webm"],
        poster_file_ids: ["p1.jpg"],
        stored_bytes: 5000,
      })
      // Live: nothing is forgotten
      await service.forgetVideoFiles(video.id, ["kaynak-m2.mov"])
      expect((await service.videoFiles(video.id))?.source_file_id).toBe("kaynak-m2.mov")

      await service.softDeleteMediaVideos([video.id])
      await service.forgetVideoFiles(video.id, ["kaynak-m2.mov", "o1.mp4"])
      expect(await service.videoFiles(video.id)).toEqual({
        id: video.id,
        status: "uploaded",
        removed: true,
        source_file_id: null,
        // Not every output was taken: the list stays for the sweep
        output_file_ids: ["o1.mp4", "o2.webm"],
        poster_file_ids: ["p1.jpg"],
      })
      expect((await service.videosWithFilesLeft()).map((row) => row.id)).toContain(video.id)
      await service.forgetVideoFiles(video.id, ["o1.mp4", "o2.webm", "p1.jpg"])
      expect(await service.videoFiles(video.id)).toMatchObject({
        output_file_ids: null,
        poster_file_ids: null,
      })
      const [row] = await service.listMediaVideos({ id: video.id }, { withDeleted: true })
      expect(row?.stored_bytes).toBe(0)
      expect(await service.videoFiles("mvid_yok")).toBeNull()
    })

    it("writes ready only while the job holds the video, and can take it back", async () => {
      const video = await waiting("r1")
      await service.claimNextVideo()
      expect(await service.beatVideo(video.id, 0)).toBe(true)
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
      // Another claim's token: not written
      expect(await service.markVideoReady(video.id, 1, ready)).toBe(false)
      expect(await service.markVideoReady(video.id, 0, ready)).toBe(true)
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
      expect(await service.beatVideo(video.id, 0)).toBe(false)
      expect(await service.markVideoReady(video.id, 0, ready)).toBe(false)

      // Taken back (a later step failed): processing, its outputs forgotten, the source counted
      expect(await service.unmarkVideoReady(video.id)).toBe(true)
      const [back] = await service.listMediaVideos({ id: video.id })
      expect(back).toMatchObject({
        status: "processing",
        outputs: null,
        output_file_ids: null,
        stored_bytes: 1000,
      })

      // Ready again, then its source is gone: no longer named nor counted
      await service.markVideoReady(video.id, 0, ready)
      await service.forgetVideoSource(video.id)
      const [clean] = await service.listMediaVideos({ id: video.id })
      expect(clean).toMatchObject({ source_file_id: null, stored_bytes: 600 })
      // Without its source a ready video is never taken back (review M1)
      expect(await service.unmarkVideoReady(video.id)).toBe(false)
      expect((await service.listMediaVideos({ id: video.id }))[0]?.status).toBe("ready")

      // A video removed while it was processed is not written
      const gone = await waiting("r2")
      await service.claimNextVideo()
      await service.softDeleteMediaVideos([gone.id])
      expect(await service.beatVideo(gone.id, 0)).toBe(false)
      expect(await service.markVideoReady(gone.id, 0, ready)).toBe(false)
      expect(
        await service.markVideoTried(gone.id, 0, { status: "failed", attempts: 1, error_code: "x" })
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

      // Taken again: the job taken for dead (its claim saw 1) can no longer write (review S2)
      await service.claimNextVideo()
      expect(await service.beatVideo(video.id, 1)).toBe(false)
      const stale = { status: "failed" as const, attempts: 2, error_code: "video.unreadable" }
      expect(await service.markVideoTried(video.id, 1, stale)).toBe(false)
      // The new claim writes its failed try
      expect(await service.beatVideo(video.id, 2)).toBe(true)
      expect(
        await service.markVideoTried(video.id, 2, {
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
