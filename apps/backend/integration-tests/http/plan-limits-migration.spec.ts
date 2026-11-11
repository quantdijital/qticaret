import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { MIGRATION_MODULE } from "../../src/modules/migration"
import type MigrationModuleService from "../../src/modules/migration/service"
import { managedForThisFile } from "../helpers/control-plane"
import type { HttpClient } from "../helpers/http"
import { setPlanLimits } from "../helpers/plan-limits"
import { wordpressFixture } from "../helpers/wordpress"

jest.setTimeout(600 * 1000)

/**
 * adr/0061 Ek C14 review M3: moving a shop in on a package whose storage is
 * full. Its products still move; each picture is named in the report as
 * refused by the package (`migration.image_plan_limit`), none is stored.
 */
medusaIntegrationTestRunner({
  testSuite: ({ api, getContainer }) => {
    const http = api as HttpClient
    managedForThisFile()
    const wp = wordpressFixture(http, getContainer)

    it("moves the products without their pictures past the storage limit", async () => {
      await setPlanLimits(getContainer(), { storage_mb: 0 })

      const applied = await wp.run("apply")
      const items = await getContainer()
        .resolve<MigrationModuleService>(MIGRATION_MODULE)
        .listMigrationItems({ kind: "image" }, { select: ["status", "error_code"] })

      expect(applied.counts).toMatchObject({
        product: { created: 4, failed: 0 },
        image: { read: 3, created: 0, skipped: 3 },
      })
      expect(items).toHaveLength(3)
      expect(
        items.every(
          (item) => item.status === "skipped" && item.error_code === "migration.image_plan_limit"
        )
      ).toBe(true)
    })
  },
})
