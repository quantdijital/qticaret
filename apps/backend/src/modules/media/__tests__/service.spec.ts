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
  },
})
