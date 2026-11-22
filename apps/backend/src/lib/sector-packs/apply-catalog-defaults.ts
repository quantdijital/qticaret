import { packItemKey } from "@qticaret/sector-packs"
import type { SectorPack } from "@qticaret/sector-packs"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { catalogSection } from "../../modules/platform-settings/sections/catalog"
import type { CatalogSettings } from "../../modules/platform-settings/sections/catalog"
import { mergePatch } from "../../modules/platform-settings/sections/define"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { updatePlatformSettingsWorkflow } from "../../workflows/platform-settings/update-platform-settings"
import type { ApplyContext } from "./context"

type Field = keyof CatalogSettings

/** The pack's `catalog.json` as the settings section's fields (adr/0076 §12). */
export function catalogPatchOf(pack: Pick<SectorPack, "catalog">): Partial<CatalogSettings> {
  const catalog = pack.catalog ?? {}
  return {
    ...(catalog.new_product
      ? {
          new_product_kind: catalog.new_product.kind,
          new_product_booking_mode: catalog.new_product.booking_mode,
        }
      : {}),
    ...(catalog.dated_schema_type ? { dated_schema_type: catalog.dated_schema_type } : {}),
  }
}

/** What is wrong with the pack's catalog defaults as the section takes them; none when right. */
export function catalogProblems(pack: Pick<SectorPack, "catalog">): string[] {
  const parsed = catalogSection.full.safeParse(
    mergePatch(catalogSection.defaults, catalogPatchOf(pack))
  )
  return parsed.success
    ? []
    : parsed.error.issues.map((issue) => `catalog ${issue.path.join(".")}: ${issue.message}`)
}

/**
 * The pack's catalog defaults (adr/0076 §12), saved through the settings
 * workflow. A field the shop has changed from the platform's default is
 * kept: only one still at the default takes the pack's. The kind and its
 * booking mode go together (a dated product is a service): both are taken
 * only when both are still at the default.
 */
export async function applyCatalogDefaults(context: ApplyContext): Promise<void> {
  const offer = catalogPatchOf(context.pack)
  const pending = (Object.keys(offer) as Field[]).filter(
    (field) => !context.offered.has(packItemKey.setting("catalog", field))
  )
  if (pending.length === 0) {
    return
  }
  const settings =
    context.container.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const { values } = await settings.readSection("catalog")
  const current = values as unknown as CatalogSettings
  const untouched = (field: Field) => current[field] === catalogSection.defaults[field]
  const together: Field[] = ["new_product_kind", "new_product_booking_mode"]
  const takes = (field: Field) =>
    together.includes(field) ? together.every(untouched) : untouched(field)
  const patch = Object.fromEntries(
    pending
      .filter((field) => takes(field) && current[field] !== offer[field])
      .map((field) => [field, offer[field]])
  )
  if (Object.keys(patch).length > 0) {
    await updatePlatformSettingsWorkflow(context.container).run({
      input: { section: "catalog", values: patch, actor_id: null },
    })
  }
  for (const field of pending) {
    await context.record({
      key: packItemKey.setting("catalog", field),
      kind: "setting",
      outcome: Object.hasOwn(patch, field) ? "added" : "kept",
      record_id: null,
    })
  }
}
