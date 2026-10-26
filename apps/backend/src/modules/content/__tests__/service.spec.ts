import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_MODULE } from ".."
import type ContentModuleService from "../service"

jest.setTimeout(120 * 1000)

const entry = (kind: "page" | "post", handle: string) => ({
  kind,
  title: "Hakkımızda",
  handle,
  body: { type: "doc", content: [] },
})

moduleIntegrationTestRunner<ContentModuleService>({
  moduleName: CONTENT_MODULE,
  resolve: "./src/modules/content",
  testSuite: ({ service }) => {
    it("keeps a draft with its document", async () => {
      const saved = await service.createContentEntries(entry("page", "hakkimizda"))
      expect(saved).toMatchObject({ status: "draft", published_at: null, kind: "page" })
      expect(saved.id).toMatch(/^cnt_/)
      expect((await service.retrieveContentEntry(saved.id)).body).toEqual({
        type: "doc",
        content: [],
      })
    })

    it("holds a handle once per kind", async () => {
      await service.createContentEntries(entry("page", "kargo"))
      await service.createContentEntries(entry("post", "kargo"))
      await expect(service.createContentEntries(entry("page", "kargo"))).rejects.toThrow()
    })
  },
})
