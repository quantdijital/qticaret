import type { MedusaContainer } from "@medusajs/framework/types"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack } from "@qticaret/sector-packs"
import type { SectorPack } from "@qticaret/sector-packs"
import { applySectorPack } from "../../src/lib/sector-packs/apply"
import { CONTENT_MODULE } from "../../src/modules/content"
import type ContentModuleService from "../../src/modules/content/service"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { setFeatureFlagWorkflow } from "../../src/workflows/platform-settings/set-feature-flag"
import { updatePlatformSettingsWorkflow } from "../../src/workflows/platform-settings/update-platform-settings"

jest.setTimeout(240 * 1000)

const travel = sectorPack("travel") as SectorPack
// A template, its five attributes, ten categories, two flags, three catalog defaults, a page
const TRAVEL_ITEMS = 1 + 5 + 10 + 2 + 3 + 1

/**
 * adr/0076 §12: the travel pack turns on dated selling, sets what a new
 * product starts as, and makes its cancellation terms a draft page; a
 * second run offers nothing, and a default the shop chose stays.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const container = (): MedusaContainer => getContainer()
    const settings = () =>
      container().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const pages = () =>
      container()
        .resolve<ContentModuleService>(CONTENT_MODULE)
        .listContentEntries({ kind: "page" }, { select: ["handle", "title", "status"] })
    const catalog = async () => (await settings().readSection("catalog")).values

    // Flags and settings live in a cache that outlives the database reset between tests
    afterEach(async () => {
      for (const key of ["catalog.booking", "catalog.non_physical"]) {
        await setFeatureFlagWorkflow(container()).run({
          input: { key, enabled: false, actor_id: null },
        })
      }
      await updatePlatformSettingsWorkflow(container()).run({
        input: {
          section: "catalog",
          values: { new_product_kind: "physical", new_product_booking_mode: "none" },
          actor_id: null,
        },
      })
    })

    it("turns dated selling on, starts new products as dated services and drafts its page", async () => {
      expect(await catalog()).toEqual({
        new_product_kind: "physical",
        new_product_booking_mode: "none",
        dated_schema_type: "TouristTrip",
      })
      const first = await applySectorPack(container(), travel)
      // The structured data type it names is already the default: kept, not written
      expect(first).toEqual({
        pack: "travel",
        version: travel.version,
        added: TRAVEL_ITEMS - 1,
        kept: 1,
        skipped: 0,
      })
      expect(await settings().readFeature("catalog.non_physical")).toBe(true)
      expect(await settings().readFeature("catalog.booking")).toBe(true)
      expect(await catalog()).toEqual({
        new_product_kind: "service",
        new_product_booking_mode: "departure",
        dated_schema_type: "TouristTrip",
      })
      expect(await pages()).toEqual([
        expect.objectContaining({
          handle: "iptal-kosullari",
          title: "İptal ve Değişiklik Koşulları",
          status: "draft",
        }),
      ])

      const second = await applySectorPack(container(), travel)
      expect(second).toMatchObject({ added: 0, kept: 0, skipped: 0 })
      expect(await pages()).toHaveLength(1)
    })

    it("keeps a new product's kind the shop chose, and the page of the same handle it has", async () => {
      await updatePlatformSettingsWorkflow(container()).run({
        input: { section: "catalog", values: { new_product_kind: "digital" }, actor_id: null },
      })
      const content = container().resolve<ContentModuleService>(CONTENT_MODULE)
      await content.createContentEntries({
        kind: "page",
        handle: "iptal-kosullari",
        title: "Bizim koşullarımız",
        status: "published",
        body: { type: "doc", content: [] },
      })
      const outcome = await applySectorPack(container(), travel)
      // The kind and its booking mode and the page: kept (flags may be the last test's)
      expect(outcome.skipped).toBe(0)
      expect(outcome.kept).toBeGreaterThanOrEqual(4)
      expect(await catalog()).toMatchObject({
        new_product_kind: "digital",
        new_product_booking_mode: "none",
      })
      expect(await pages()).toEqual([
        expect.objectContaining({ title: "Bizim koşullarımız", status: "published" }),
      ])
    })

    it("refuses a dated default that is no service", async () => {
      await expect(
        updatePlatformSettingsWorkflow(container()).run({
          input: {
            section: "catalog",
            values: { new_product_booking_mode: "departure" },
            actor_id: null,
          },
        })
      ).rejects.toThrow()
    })
  },
})
