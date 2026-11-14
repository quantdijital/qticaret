import { existsSync } from "node:fs"
import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  DEFAULT_PACKS_DIR,
  PACK_CODE,
  SectorPackError,
  readPack,
  sectorPack,
} from "@qticaret/sector-packs"
import type { StorefrontPreset } from "@qticaret/sector-packs"
import { logger } from "../../../lib/logging"
import { storedSettings } from "../../../lib/storefront/layout-settings"
import { SECTOR_PACKS_MODULE } from "../../../modules/sector-packs"
import type SectorPacksModuleService from "../../../modules/sector-packs/service"
import { layoutRow } from "../../../workflows/storefront/layout-row"
import { GENERAL_PACK } from "../../../workflows/storefront/preset-apply"

/**
 * A pack's presets; a pack its loader refuses has none here and is logged
 * by its code (never its content), the others still listed. The packs are
 * read together and once (`sectorPacks`): one refused fails the read of
 * all, so each is then read on its own.
 */
function presetsOf(code: string): readonly StorefrontPreset[] {
  try {
    return sectorPack(code)?.presets ?? []
  } catch (error) {
    if (!(error instanceof SectorPackError)) {
      throw error
    }
  }
  const dir = join(DEFAULT_PACKS_DIR, code)
  if (!PACK_CODE.test(code) || !existsSync(dir)) {
    return []
  }
  try {
    return readPack(dir, code).presets
  } catch (error) {
    if (!(error instanceof SectorPackError)) {
      throw error
    }
    logger.error({ event: "storefront_preset.pack_unreadable", pack: code })
    return []
  }
}

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
    presetsOf(code).map((preset) => ({
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
