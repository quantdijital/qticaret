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
  },
})
