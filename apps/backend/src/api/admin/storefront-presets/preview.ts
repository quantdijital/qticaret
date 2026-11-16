import { readFile, stat } from "node:fs/promises"
import { join } from "node:path"
import type { MedusaContainer } from "@medusajs/framework/types"
import {
  PRESET_LIMITS,
  PRESET_PREVIEW,
  SectorPackError,
  storefrontPreset,
} from "@qticaret/sector-packs"
import { SECTOR_PACKS_MODULE } from "../../../modules/sector-packs"
import type SectorPacksModuleService from "../../../modules/sector-packs/service"
import { GENERAL_PACK } from "../../../workflows/storefront/preset-apply"

/**
 * A ready-made look's picture (adr/0063 §7, `preview.webp`) for the
 * gallery the panel shows, or null: only a look the gallery lists (of
 * `general` or a pack applied here), only the file the loader found beside
 * it, by the loader's own folder and the fixed name; nothing of the path
 * comes from the request. Larger than the loader allows: none.
 */
export async function presetPreview(
  container: Pick<MedusaContainer, "resolve">,
  pack: string,
  code: string,
  dir?: string
): Promise<Buffer | null> {
  if (pack !== GENERAL_PACK) {
    const [applied] = await container
      .resolve<SectorPacksModuleService>(SECTOR_PACKS_MODULE)
      .listSectorPackApplications({ pack }, { select: ["id"], take: 1 })
    if (!applied) {
      return null
    }
  }
  let preset
  try {
    preset = storefrontPreset(pack, code, dir)
  } catch (error) {
    if (error instanceof SectorPackError) {
      return null
    }
    throw error
  }
  if (preset?.preview !== PRESET_PREVIEW) {
    return null
  }
  const file = join(preset.dir, PRESET_PREVIEW)
  const info = await stat(file).catch(() => null)
  if (!info?.isFile() || info.size > PRESET_LIMITS.previewBytes) {
    return null
  }
  return readFile(file)
}
