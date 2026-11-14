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

    it("sums up the kept revisions newest first with their menu set only, not the document", async () => {
      const at = new Date("2026-11-01T09:00:00.000Z")
      const menus = [{ title: "Ana menü", location: "main", items: [] }]
      await service.createStorefrontLayoutRevisions([
        { revision: 1, document: { home: [{ id: "a" }], settings: { menus } }, published_at: at },
        {
          revision: 2,
          document: { home: [{ id: "b" }] },
          published_at: at,
          published_by: "user_1",
        },
      ])
      const gone = await service.createStorefrontLayoutRevisions({
        revision: 3,
        document: {},
        published_at: at,
      })
      await service.softDeleteStorefrontLayoutRevisions(gone.id)

      const summaries = await service.revisionSummaries()

      expect(summaries).toEqual([
        { revision: 2, published_at: at, published_by: "user_1", menus: null },
        { revision: 1, published_at: at, published_by: null, menus },
      ])
    })
  },
})
