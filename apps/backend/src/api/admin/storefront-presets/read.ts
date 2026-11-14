import type { MedusaContainer } from "@medusajs/framework/types"
import { sectorPack } from "@qticaret/sector-packs"
import { storedSettings } from "../../../lib/storefront/layout-settings"
import { SECTOR_PACKS_MODULE } from "../../../modules/sector-packs"
import type SectorPacksModuleService from "../../../modules/sector-packs/service"
import { layoutRow } from "../../../workflows/storefront/layout-row"
import { GENERAL_PACK } from "../../../workflows/storefront/preset-apply"

/**
 * The gallery's cards (adr/0063 §7): `general`'s presets and those of every
 * pack applied here (`sector_pack_application`), as this build has them.
 * `in_draft` / `live`: the preset the draft and the live design were last
 * given, at any version; the panel compares `version` for "yeni sürüm var".
 */
export async function presetGallery(container: MedusaContainer) {
  const [applied, row] = await Promise.all([
    container
      .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      .listSectorPackApplications({}, { select: ["pack"], take: null }),
    layoutRow(container),
  ])
  const draft = storedSettings(row?.draft ?? null).preset
  const live = storedSettings(row?.published ?? null).preset
  const packs = [
    GENERAL_PACK,
    ...applied.map((each) => each.pack).filter((p) => p !== GENERAL_PACK),
  ]
  return packs.flatMap((code) =>
    (sectorPack(code)?.presets ?? []).map((preset) => ({
      pack: preset.pack,
      code: preset.code,
      version: preset.version,
      theme: preset.theme,
      name: preset.name,
      description: preset.description,
      tone: preset.tone,
      has_menus: preset.menus !== null,
      has_demo: preset.demo !== null,
      has_preview: preset.preview !== null,
      in_draft: draft?.pack === preset.pack && draft.code === preset.code ? draft.version : null,
      live: live?.pack === preset.pack && live.code === preset.code ? live.version : null,
    }))
  )
}
