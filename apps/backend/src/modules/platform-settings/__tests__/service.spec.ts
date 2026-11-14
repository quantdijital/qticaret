import { moduleIntegrationTestRunner } from "@medusajs/test-utils"
import { PLATFORM_SETTINGS_MODULE } from ".."
import type PlatformSettingsModuleService from "../service"

jest.setTimeout(120 * 1000)

const reasonOf = async (run: Promise<unknown>): Promise<unknown> => {
  try {
    await run
  } catch (error) {
    const fields = error as { safeMessage?: unknown; message?: unknown }
    return fields.safeMessage ?? fields.message
  }
  return "no error"
}

moduleIntegrationTestRunner<PlatformSettingsModuleService>({
  moduleName: PLATFORM_SETTINGS_MODULE,
  resolve: "./src/modules/platform-settings",
  testSuite: ({ service }) => {
    describe("sections", () => {
      it("returns defaults before anything is saved", async () => {
        expect(await service.getSection("store")).toMatchObject({ timezone: "Europe/Istanbul" })
        expect(await service.readSection("seo")).toMatchObject({ version: 0 })
      })

      it("merges a save over the current values and counts versions", async () => {
        const first = await service.saveSection("store", { weight_unit: "kg" }, "user_1")
        await service.saveSection("store", { contact_email: "destek@example.com" }, "user_1")

        expect(first.before).toMatchObject({ weight_unit: "g" })
        expect(first.previous).toBeNull()
        expect(await service.readSection("store")).toMatchObject({
          version: 2,
          values: { weight_unit: "kg", contact_email: "destek@example.com" },
        })
        // The cache sees the write at once in the writing process
        expect(await service.getSection("store")).toMatchObject({ weight_unit: "kg" })
      })

      it("refuses an invalid template with its key and stores nothing", async () => {
        const reason = await reasonOf(
          service.saveSection("seo", { title_templates: { product: "{fiyat}" } }, null)
        )

        expect(reason).toBe("seo.template_invalid")
        expect(await service.readSection("seo")).toMatchObject({ version: 0 })
      })

      it("holds a new main colour to the page's well, never a stored one (adr/0062 §6)", async () => {
        // #919191: 3.01:1 on the steel page, 2.78 in its well
        const reason = await reasonOf(
          service.saveSection("theme", { colors: { primary: "#919191" } }, null)
        )
        expect(reason).toBe("platform_settings.color_contrast")
        expect(await service.readSection("theme")).toMatchObject({ version: 0 })

        // A row saved before the rule: read as it is, and its other fields still save
        const stored = {
          ...(await service.getSection("theme")),
          colors: { primary: "#919191", accent: null, background: "steel" },
        }
        await service.createSettingsSections({ section: "theme", values: stored, updated_by: null })
        expect((await service.readSection("theme")).values).toMatchObject({
          colors: { primary: "#919191" },
        })
        const saved = await service.saveSection("theme", { radius: "round" }, null)
        expect(saved.after).toMatchObject({ radius: "round", colors: { primary: "#919191" } })
        // Moving to a darker page under the same colour is asked again
        expect(
          await reasonOf(service.saveSection("theme", { colors: { background: "warm" } }, null))
        ).toBe("platform_settings.color_contrast")
        expect(
          (await service.saveSection("theme", { colors: { primary: "#8a8a8a" } }, null)).after
        ).toMatchObject({ colors: { primary: "#8a8a8a", background: "steel" } })
      })

      it("puts a section back as it was", async () => {
        const first = await service.saveSection("store", { weight_unit: "kg" }, null)
        await service.restoreSection("store", first.previous)
        expect(await service.readSection("store")).toMatchObject({ version: 0 })

        await service.saveSection("store", { weight_unit: "kg" }, null)
        const second = await service.saveSection("store", { dimension_unit: "mm" }, null)
        await service.restoreSection("store", second.previous)
        expect((await service.getSection("store"))["dimension_unit"]).toBe("cm")
      })
    })

    describe("feature flags", () => {
      it("uses the default until a tenant changes it, and forgets a return to the default", async () => {
        expect(await service.isFeatureEnabled("test.sample")).toBe(false)

        const on = await service.setFeature("test.sample", true, "user_1")
        expect(on).toEqual({ before: false, after: true, previousOverride: null })
        expect(await service.isFeatureEnabled("test.sample")).toBe(true)

        await service.setFeature("test.sample", false, "user_1")
        const features = await service.listFeatures()
        expect(features.find((feature) => feature.key === "test.sample")).toMatchObject({
          enabled: false,
          overridden: false,
        })
        expect(await service.listFeatureOverrides({})).toHaveLength(0)
      })

      it("keeps platform flags and unknown flags out of the tenant's reach", async () => {
        expect(await reasonOf(service.setFeature("test.platform_sample", false, null))).toBe(
          "features.platform_owned"
        )
        expect(await reasonOf(service.setFeature("nope", true, null))).toBe("features.unknown")
        expect(await service.isFeatureEnabled("nope")).toBe(false)
      })

      it("ignores a stored override on a platform flag, and reads flags past the cache", async () => {
        // A row from when the flag was the tenant's, or written by hand
        await service.createFeatureOverrides({ key: "test.platform_sample", enabled: false })

        expect(await service.isFeatureEnabled("test.platform_sample")).toBe(true)
        expect(await service.readFeature("test.platform_sample")).toBe(true)
        expect(await service.readFeature("nope")).toBeNull()
      })

      it("restores an override as it was", async () => {
        const change = await service.setFeature("test.sample", true, null)
        await service.restoreFeature("test.sample", change.previousOverride)

        expect(await service.isFeatureEnabled("test.sample")).toBe(false)
      })
    })
  },
})
