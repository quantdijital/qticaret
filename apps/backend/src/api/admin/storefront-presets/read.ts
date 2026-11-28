import { existsSync, readdirSync } from "node:fs"
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
import { designSummary } from "../../../lib/storefront/designs/summary"
import { storedSettings } from "../../../lib/storefront/layout-settings"
import { SECTOR_PACKS_MODULE } from "../../../modules/sector-packs"
import type SectorPacksModuleService from "../../../modules/sector-packs/service"
import { layoutRow } from "../../../workflows/storefront/layout-row"
import { GENERAL_PACK } from "../../../workflows/storefront/preset-apply"

interface PackPresets {
  /** The pack's name as its manifest gives it (`Bıçak ve çatal-bıçak`); its code when unread. */
  name: string
  presets: readonly StorefrontPreset[]
}

const NONE = (code: string): PackPresets => ({ name: code, presets: [] })

/**
 * A pack's name and presets; a pack its loader refuses has none here and is
 * logged by its code (never its content), the others still listed. The
 * packs are read together and once (`sectorPacks`): one refused fails the
 * read of all, so each is then read on its own.
 */
function presetsOf(code: string): PackPresets {
  try {
    const pack = sectorPack(code)
    return pack ? { name: pack.name, presets: pack.presets } : NONE(code)
  } catch (error) {
    if (!(error instanceof SectorPackError)) {
      throw error
    }
  }
  const dir = join(DEFAULT_PACKS_DIR, code)
  if (!PACK_CODE.test(code) || !existsSync(dir)) {
    return NONE(code)
  }
  try {
    const pack = readPack(dir, code)
    return { name: pack.name, presets: pack.presets }
  } catch (error) {
    if (!(error instanceof SectorPackError)) {
      throw error
    }
    logger.error({ event: "storefront_preset.pack_unreadable", pack: code })
    return NONE(code)
  }
}

/** Every pack this build has, by its folder's name (a pack's code), in order. */
export function buildPackCodes(dir: string = DEFAULT_PACKS_DIR): string[] {
  return readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && PACK_CODE.test(entry.name))
    .map((entry) => entry.name)
    .sort((a, b) => a.localeCompare(b))
}

/**
 * The gallery's cards (adr/0063 §7): `general`'s presets and those of every
 * pack applied here (`sector_pack_application`), as this build has them;
 * then, the owner's 2026-11-28 decision, the other sectors' looks
 * (`own: false`), each with its pack's name (`sector`): their style can be
 * taken alone, or their sections with it where the shop has their records.
 * `in_draft` / `live`: the preset the draft and the live design were last
 * given, at any version (not when a saved look was given since: that one
 * is in the draft); the panel compares `version` for "yeni sürüm var".
 * With adr/0064 Ek 2026-11-17: the colour family it is shown in (`family`,
 * else its own code) and its colour's name, the card's sketch (`summary`),
 * whether it brings its own header and footer, and its picture's address.
 */
export async function presetGallery(container: MedusaContainer) {
  const [applied, row] = await Promise.all([
    container
      .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      .listSectorPackApplications({}, { select: ["pack"], take: null }),
    layoutRow(container),
  ])
  const presetOf = (stored: unknown) => {
    const settings = storedSettings(stored)
    return settings.design?.id ? null : settings.preset
  }
  const draft = presetOf(row?.draft ?? null)
  const live = presetOf(row?.published ?? null)
  const own = [GENERAL_PACK, ...applied.map((each) => each.pack).filter((p) => p !== GENERAL_PACK)]
  const others = buildPackCodes().filter((code) => !own.includes(code))
  const packs = [
    ...own.map((code) => ({ code, own: true })),
    ...others.map((code) => ({ code, own: false })),
  ]
  return packs.flatMap(({ code, own: isOwn }) => {
    const { name: sectorName, presets } = presetsOf(code)
    return presets.map((preset) => ({
      pack: preset.pack,
      code: preset.code,
      version: preset.version,
      theme: preset.theme,
      name: preset.name,
      description: preset.description,
      tone: preset.tone,
      family: preset.family ?? preset.code,
      swatch: preset.swatch ?? null,
      /** The sector the look was made for (its pack) and whether it is this shop's own. */
      sector: { code, name: sectorName },
      own: isOwn,
      summary: designSummary(
        {
          groups: preset.layout,
          theme: preset.theme_settings,
          preset: { pack: preset.pack, code: preset.code, version: preset.version },
        },
        { source: "preset", source_name: preset.name, edited: false, reason: null }
      ),
      has_menus: preset.menus !== null,
      has_demo: preset.demo !== null,
      has_preview: preset.preview !== null,
      has_header: (preset.layout.header?.length ?? 0) > 0,
      has_footer: (preset.layout.footer?.length ?? 0) > 0,
      preview_url:
        preset.preview !== null
          ? `/admin/storefront-presets/${preset.pack}/${preset.code}/preview?v=${String(preset.version)}`
          : null,
      in_draft: draft?.pack === preset.pack && draft.code === preset.code ? draft.version : null,
      live: live?.pack === preset.pack && live.code === preset.code ? live.version : null,
    }))
  })
}
