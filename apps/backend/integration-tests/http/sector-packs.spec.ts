import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { medusaIntegrationTestRunner } from "@medusajs/test-utils"
import { sectorPack } from "@qticaret/sector-packs"
import type { SectorPack } from "@qticaret/sector-packs"
import { readTenantResult } from "@qticaret/types/control-plane"
import { applySectorPack } from "../../src/lib/sector-packs/apply"
import { PLATFORM_SETTINGS_MODULE } from "../../src/modules/platform-settings"
import type PlatformSettingsModuleService from "../../src/modules/platform-settings/service"
import { PRODUCT_ATTRIBUTES_MODULE } from "../../src/modules/product-attributes"
import type ProductAttributesModuleService from "../../src/modules/product-attributes/service"
import { SECTOR_PACKS_MODULE } from "../../src/modules/sector-packs"
import type SectorPacksModuleService from "../../src/modules/sector-packs/service"
import applyPack from "../../src/scripts/apply-pack"
import { setFeatureFlagWorkflow } from "../../src/workflows/platform-settings/set-feature-flag"
import { updatePlatformSettingsWorkflow } from "../../src/workflows/platform-settings/update-platform-settings"
import { deleteAttributeTemplateWorkflow } from "../../src/workflows/product-attributes/templates"

jest.setTimeout(240 * 1000)

function packOf(code: string): SectorPack {
  const found = sectorPack(code)
  if (!found) {
    throw new Error(`no ${code} pack`)
  }
  return found
}

const cutlery = packOf("cutlery")
// Everything the cutlery pack holds: templates, attributes, categories, flags, SEO templates
const CUTLERY_ITEMS = 2 + 31 + 16 + 2 + 1
const BRAND = "{marka} Bıçak ve Çakı Modelleri | {mağaza}"

/** The cutlery pack one version on: a template, attributes, a category and an SEO template more. */
const cutleryV2: SectorPack = {
  ...cutlery,
  version: 2,
  attribute_templates: [
    ...cutlery.attribute_templates.map((template) =>
      template.handle === "bicak-ve-caki"
        ? {
            ...template,
            groups: [
              ...((template["groups"] as unknown[] | undefined) ?? []),
              { key: "gorunum", name: "Görünüm", rank: 6 },
            ],
            definitions: [
              ...template.definitions,
              { key: "namlu_rengi", label: "Namlu rengi", type: "text", group: "gorunum" },
            ],
          }
        : template
    ),
    {
      handle: "bileme-urunleri",
      name: "Bileme ürünleri",
      definitions: [{ key: "kum", label: "Kum", type: "number", is_required: true }],
    },
  ],
  categories: [
    ...cutlery.categories,
    { handle: "bileme-taslari", name: "Bileme Taşları", parent: "bakim-ve-aksesuar" },
  ],
  seo: {
    title_templates: {
      ...cutlery.seo.title_templates,
      landing: "{başlık} | {kategori} | {mağaza}",
    },
  },
}

/**
 * adr/0061 C12: `tenant:apply-pack` adds what the shop never had and
 * nothing else: twice is once, the shop's edits and removals stay, a newer
 * version adds only its new items.
 */
medusaIntegrationTestRunner({
  testSuite: ({ getContainer }) => {
    const container = (): MedusaContainer => getContainer()
    const attributes = () =>
      container().resolve<ProductAttributesModuleService>(PRODUCT_ATTRIBUTES_MODULE)
    const settings = () =>
      container().resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    const products = () => container().resolve(Modules.PRODUCT)

    /** What a pack can touch, as a comparable picture of the shop. */
    async function shop() {
      const templates = await attributes().listAttributeTemplates(
        {},
        { relations: ["definitions"], order: { handle: "ASC" } }
      )
      const categories = await products().listProductCategories(
        {},
        { select: ["handle", "name", "is_active", "parent_category_id"], take: null }
      )
      const seo = (await settings().readSection("seo")).values as {
        title_templates: Record<string, string>
      }
      return {
        templates: templates.map((template) => ({
          handle: template.handle,
          name: template.name,
          groups: template.groups,
          definitions: template.definitions
            .map((d) => `${d.key}:${d.label}:${String(d.is_required)}:${d.group ?? ""}`)
            .sort(),
        })),
        categories: categories
          .map(
            (c) =>
              `${c.handle}:${c.name}:${String(c.is_active)}:${c.parent_category_id ? "child" : "top"}`
          )
          .sort(),
        flags: {
          restricted: await settings().readFeature("catalog.restricted"),
          age: await settings().readFeature("compliance.age_verification"),
        },
        seo: seo.title_templates,
      }
    }

    it("applies the pack once, then again with the same shop and nothing offered", async () => {
      const first = await applySectorPack(container(), cutlery)
      expect(first).toEqual({
        pack: "cutlery",
        version: 1,
        added: CUTLERY_ITEMS,
        kept: 0,
        skipped: 0,
      })
      const after = await shop()
      expect(after.templates.map((t) => t.handle)).toEqual(["bicak-seti", "bicak-ve-caki"])
      expect(after.templates[1]?.definitions).toHaveLength(21)
      // Hidden until the shop gives each its image and shows it
      expect(after.categories).toHaveLength(16)
      expect(after.categories.every((line) => line.includes(":false:"))).toBe(true)
      expect(after.categories).toContain("kesim-bicaklari:Kesim Bıçakları:false:child")
      expect(after.flags).toEqual({ restricted: true, age: true })
      expect(after.seo["brand"]).toBe(BRAND)

      const second = await applySectorPack(container(), cutlery)
      expect(second).toEqual({ pack: "cutlery", version: 1, added: 0, kept: 0, skipped: 0 })
      expect(await shop()).toEqual(after)
      const ledger = container().resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      expect((await ledger.offeredItems("cutlery")).size).toBe(CUTLERY_ITEMS)
    })

    it("keeps what the shop had and never writes over or brings back what it changed", async () => {
      // The shop's own template of the same handle and its own brand title, before the pack
      await attributes().createAttributeTemplates({ name: "Setlerimiz", handle: "bicak-seti" })
      await updatePlatformSettingsWorkflow(container()).run({
        input: {
          section: "seo",
          values: { title_templates: { brand: "{marka} | {mağaza}" } },
          actor_id: null,
        },
      })
      const first = await applySectorPack(container(), cutlery)
      // bicak-seti and its 10 attributes (none of which the shop's has), the brand title
      expect(first).toMatchObject({ added: CUTLERY_ITEMS - 12, kept: 2, skipped: 10 })
      const own = await attributes().listAttributeTemplates(
        { handle: "bicak-seti" },
        { relations: ["definitions"] }
      )
      expect(own[0]?.name).toBe("Setlerimiz")
      expect(own[0]?.definitions).toHaveLength(0)

      // Then the shop edits and removes pack items
      const [knives] = await attributes().listAttributeTemplates(
        { handle: "bicak-ve-caki" },
        { relations: ["definitions"] }
      )
      const steel = knives?.definitions.find((d) => d.key === "namlu_celigi")
      const weight = knives?.definitions.find((d) => d.key === "agirlik")
      await attributes().updateAttributeTemplates({ id: knives?.id ?? "", name: "Bıçaklarımız" })
      await attributes().updateAttributeDefinitions({ id: steel?.id ?? "", label: "Çelik" })
      await attributes().deleteAttributeDefinitions([weight?.id ?? ""])
      const [swords] = await products().listProductCategories({ handle: "kiliclar" })
      await products().deleteProductCategories([swords?.id ?? ""])
      await setFeatureFlagWorkflow(container()).run({
        input: { key: "compliance.age_verification", enabled: false, actor_id: null },
      })
      await updatePlatformSettingsWorkflow(container()).run({
        input: {
          section: "seo",
          values: { title_templates: { brand: "Markamız {marka} | {mağaza}" } },
          actor_id: null,
        },
      })
      const edited = await shop()

      const again = await applySectorPack(container(), cutlery)
      expect(again).toMatchObject({ added: 0, kept: 0, skipped: 0 })
      expect(await shop()).toEqual(edited)
      expect(edited.templates.find((t) => t.handle === "bicak-ve-caki")?.name).toBe("Bıçaklarımız")
      expect(edited.categories.some((line) => line.startsWith("kiliclar:"))).toBe(false)
      expect(edited.flags.age).toBe(false)
      expect(edited.seo["brand"]).toBe("Markamız {marka} | {mağaza}")
    })

    it("adds only a newer version's new items", async () => {
      await applySectorPack(container(), cutlery)
      const [sets] = await attributes().listAttributeTemplates({ handle: "bicak-seti" })
      await deleteAttributeTemplateWorkflow(container()).run({ input: { id: sets?.id ?? "" } })
      const [care] = await products().listProductCategories({ handle: "bakim-ve-aksesuar" })
      const before = await shop()

      const result = await applySectorPack(container(), cutleryV2)
      // A template and its attribute, an attribute in a template of v1, a category, an SEO template
      expect(result).toEqual({ pack: "cutlery", version: 2, added: 5, kept: 0, skipped: 0 })
      const after = await shop()
      expect(after.templates.map((t) => t.handle)).toEqual(["bicak-ve-caki", "bileme-urunleri"])
      const knives = after.templates.find((t) => t.handle === "bicak-ve-caki")
      const old = before.templates.find((t) => t.handle === "bicak-ve-caki")
      expect(knives?.definitions).toEqual(
        [...(old?.definitions ?? []), "namlu_rengi:Namlu rengi:false:gorunum"].sort()
      )
      expect((knives?.groups as unknown as { key: string }[]).map((group) => group.key)).toContain(
        "gorunum"
      )
      // A whole new template is made as the pack has it
      expect(after.templates.find((t) => t.handle === "bileme-urunleri")?.definitions).toEqual([
        "kum:Kum:true:",
      ])
      const [stones] = await products().listProductCategories(
        { handle: "bileme-taslari" },
        { select: ["parent_category_id", "is_active"] }
      )
      expect(stones).toMatchObject({ parent_category_id: care?.id, is_active: false })
      expect(after.seo["landing"]).toBe("{başlık} | {kategori} | {mağaza}")

      const ledger = container().resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      const [applied] = await ledger.listSectorPackApplications({ pack: "cutlery" })
      expect(applied?.version).toBe(2)
      // Again at v2, and back at v1 (an older build): nothing more, the version stays
      expect(await applySectorPack(container(), cutleryV2)).toMatchObject({ added: 0 })
      expect(await applySectorPack(container(), cutlery)).toMatchObject({ added: 0 })
      expect((await ledger.listSectorPackApplications({ pack: "cutlery" }))[0]?.version).toBe(2)
      expect(await shop()).toEqual(after)
    })

    it("prints one result line, and unknown_pack with exit code 1 for a pack this build lacks", async () => {
      const written: string[] = []
      const spy = jest.spyOn(process.stdout, "write").mockImplementation((chunk: unknown) => {
        written.push(String(chunk))
        return true
      })
      try {
        await applyPack({ container: container(), args: ["pack=general"] })
        expect(readTenantResult(written.join(""))).toEqual({
          status: "applied",
          pack: "general",
          version: 2,
          added: 6,
          kept: 0,
          skipped: 0,
        })
        written.length = 0
        await applyPack({ container: container(), args: ["pack=yok"] })
        expect(readTenantResult(written.join(""))).toEqual({ status: "unknown_pack" })
        expect(process.exitCode).toBe(1)
      } finally {
        spy.mockRestore()
        process.exitCode = 0
      }
    })
  },
})
