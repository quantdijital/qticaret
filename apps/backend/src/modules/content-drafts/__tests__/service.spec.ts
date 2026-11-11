import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { CONTENT_DRAFTS_MODULE } from ".."
import type ContentDraftsModuleService from "../service"

jest.setTimeout(120 * 1000)

moduleIntegrationTestRunner<ContentDraftsModuleService>({
  moduleName: CONTENT_DRAFTS_MODULE,
  resolve: "./src/modules/content-drafts",
  testSuite: ({ service }) => {
    it("gives the month's last draft to one of two asks at once", async () => {
      const march = new Date("2026-03-15T10:00:00Z")
      await service.claimQuota(3, march)
      await service.claimQuota(3, march)

      const both = await Promise.all([service.claimQuota(3, march), service.claimQuota(3, march)])

      expect(both.filter(Boolean)).toHaveLength(1)
      expect(await service.usedThisMonth(march)).toBe(3)
    })

    // The month in Turkey (UTC+3), as the usage report and the plan count it (adr/0061 Ek C14 L2)
    it("starts each month afresh", async () => {
      const april = new Date("2026-04-30T20:00:00Z") // 23:00 on 30 April in Turkey
      const may = new Date("2026-04-30T21:30:00Z") // 00:30 on 1 May in Turkey

      expect(await service.claimQuota(1, april)).toBe(true)
      expect(await service.claimQuota(1, april)).toBe(false)
      expect(await service.claimQuota(1, may)).toBe(true)
      expect(await service.usedThisMonth(may)).toBe(1)
    })
  },
})
