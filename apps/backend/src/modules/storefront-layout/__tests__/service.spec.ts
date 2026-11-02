import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { STOREFRONT_LAYOUT_MODULE } from ".."
import type StorefrontLayoutModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<StorefrontLayoutModuleService>({
  moduleName: STOREFRONT_LAYOUT_MODULE,
  resolve: "./src/modules/storefront-layout",
  testSuite: ({ service }) => {
    it("keeps a draft apart from what is published", async () => {
      const layout = await service.createStorefrontLayouts({
        draft: { home: [{ id: "a1b2c3", type: "posts" }] },
      })
      expect(layout).toMatchObject({ published: null, revision: 0, published_at: null })

      await service.updateStorefrontLayouts({
        id: layout.id,
        published: layout.draft,
        published_at: new Date(),
        revision: 1,
      })
      const [stored] = await service.listStorefrontLayouts({})
      expect(stored?.published).toEqual({ home: [{ id: "a1b2c3", type: "posts" }] })
      expect(stored?.revision).toBe(1)
    })

    it("keeps one revision per number", async () => {
      const revision = { document: {}, published_at: new Date() }
      await service.createStorefrontLayoutRevisions({ ...revision, revision: 1 })
      await expect(
        service.createStorefrontLayoutRevisions({ ...revision, revision: 1 })
      ).rejects.toThrow()
    })
  },
})
