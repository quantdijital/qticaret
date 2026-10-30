import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { LEGAL_MODULE } from ".."
import type LegalModuleService from "../service"

jest.setTimeout(60 * 1000)

const body = { type: "doc", content: [] }

moduleIntegrationTestRunner<LegalModuleService>({
  moduleName: LEGAL_MODULE,
  resolve: "./src/modules/legal",
  testSuite: ({ service }) => {
    it("keeps one draft and one published version per kind, numbered in order", async () => {
      await service.createLegalDocuments({
        kind: "return_policy",
        version: 1,
        status: "published",
        title: "İade",
        body,
      })
      await service.createLegalDocuments({
        kind: "return_policy",
        version: 2,
        status: "draft",
        title: "İade",
        body,
      })

      const secondDraft = service.createLegalDocuments({
        kind: "return_policy",
        version: 3,
        status: "draft",
        title: "İade",
        body,
      })
      const secondPublished = service.createLegalDocuments({
        kind: "return_policy",
        version: 4,
        status: "published",
        title: "İade",
        body,
      })

      await expect(secondDraft).rejects.toThrow()
      await expect(secondPublished).rejects.toThrow()
      expect(await service.nextVersion("return_policy")).toBe(3)
      expect(await service.nextVersion("cookie_policy")).toBe(1)
      expect((await service.versionOf("return_policy", "published"))?.version).toBe(1)
      expect((await service.versionOf("return_policy", "draft"))?.version).toBe(2)
    })
  },
})
