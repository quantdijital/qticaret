import { lstat, readFile } from "node:fs/promises"
import { join } from "node:path"
import {
  PACK_CODE,
  PRESET_CODE,
  PRESET_LIMITS,
  PRESET_PREVIEW,
  SectorPackError,
  storefrontPreset,
} from "@qticaret/sector-packs"

/**
 * A ready-made look's picture (`preview.webp`, adr/0063 §7) for the
 * wizard's "Görünüm" step, read from the packs this control plane ships
 * (the same files the shop's panel serves): only a look a pack has, only
 * the file its loader found, by the loader's folder and the fixed name;
 * nothing of the path comes from the request. Null for anything else.
 */
export async function presetPreview(
  pack: string,
  code: string,
  dir?: string
): Promise<Buffer | null> {
  if (!PACK_CODE.test(pack) || !PRESET_CODE.test(code)) {
    return null
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
  // lstat: a symbolic link is not the file the loader found, whatever it points at
  const info = await lstat(file).catch(() => null)
  if (!info?.isFile() || info.size > PRESET_LIMITS.previewBytes) {
    return null
  }
  return readFile(file)
}
