import { existsSync, lstatSync, openSync, readSync, closeSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { z } from "zod"
import { presetRefs } from "./preset-refs"
import {
  PRESET_CODE,
  PRESET_FILES,
  PRESET_IMAGES_DIR,
  PRESET_IMAGE_PATH,
  PRESET_LIMITS,
  PRESET_PREVIEW,
} from "./preset-schema"
import type { PresetLayout, StorefrontPreset } from "./preset-schema"
import { SectorPackError, readJsonFile } from "./read-json"

/**
 * A pack's storefront presets (adr/0063 §2), read from `presets/` beside
 * its files. Every entry is a real folder or file (never a link), named
 * as the frame allows: nothing in a preset can point outside its folder.
 */

export const PRESETS_DIR = "presets"

type FileName = keyof typeof PRESET_FILES
const REQUIRED: readonly FileName[] = ["preset.json", "theme.json", "layout.json"]

const isFileName = (name: string): name is FileName => Object.hasOwn(PRESET_FILES, name)

/**
 * The entries of a folder; a hidden one (`.DS_Store`) and a link of any
 * kind are refused: only the frame's names may be there (adr/0063 §7).
 */
function entries(dir: string, where: string) {
  const found = readdirSync(dir, { withFileTypes: true })
  for (const entry of found) {
    if (entry.name.startsWith(".")) {
      throw new SectorPackError(`${where}/${entry.name} is a hidden file`)
    }
    if (entry.isSymbolicLink()) {
      throw new SectorPackError(`${where}/${entry.name} is a link`)
    }
  }
  return found
}

// The first bytes of each image type: a file named `.png` must be one
const SIGNATURES: Readonly<Record<string, (head: Buffer) => boolean>> = {
  png: (head) => head.subarray(0, 8).equals(Buffer.from("89504e470d0a1a0a", "hex")),
  jpg: (head) => head.subarray(0, 3).equals(Buffer.from("ffd8ff", "hex")),
  webp: (head) =>
    head.subarray(0, 4).toString("latin1") === "RIFF" &&
    head.subarray(8, 12).toString("latin1") === "WEBP",
}

function head(path: string): Buffer {
  const buffer = Buffer.alloc(12)
  const fd = openSync(path, "r")
  try {
    readSync(fd, buffer, 0, 12, 0)
  } finally {
    closeSync(fd)
  }
  return buffer
}

/** An image file's size, after checking its type and size; throws naming it. */
function imageBytes(path: string, where: string, max: number): number {
  const extension = path.slice(path.lastIndexOf(".") + 1)
  if (!SIGNATURES[extension]?.(head(path))) {
    throw new SectorPackError(`${where} is not a ${extension} image`)
  }
  const { size } = lstatSync(path)
  if (size > max) {
    throw new SectorPackError(`${where} is over ${String(max)} bytes`)
  }
  return size
}

function readImages(dir: string, where: string): { path: string; bytes: number }[] {
  const folder = join(dir, PRESET_IMAGES_DIR)
  if (!existsSync(folder)) {
    return []
  }
  const images = entries(folder, `${where}/${PRESET_IMAGES_DIR}`).map((entry) => {
    const path = `${PRESET_IMAGES_DIR}/${entry.name}`
    if (!entry.isFile() || !PRESET_IMAGE_PATH.test(path)) {
      throw new SectorPackError(`${where}/${path} is not a preset image`)
    }
    return {
      path,
      bytes: imageBytes(join(dir, path), `${where}/${path}`, PRESET_LIMITS.imageBytes),
    }
  })
  if (images.length > PRESET_LIMITS.images) {
    throw new SectorPackError(`${where} has over ${String(PRESET_LIMITS.images)} images`)
  }
  const total = images.reduce((sum, image) => sum + image.bytes, 0)
  if (total > PRESET_LIMITS.imagesBytes) {
    throw new SectorPackError(
      `${where}'s images are over ${String(PRESET_LIMITS.imagesBytes)} bytes`
    )
  }
  return images.sort((a, b) => a.path.localeCompare(b.path))
}

/**
 * Section ids are fixed in the file and unique across the groups, the
 * content pages' included: a re-apply writes the same document. A page is
 * named once.
 */
function checkSectionIds(layout: PresetLayout, where: string): void {
  const { pages = [], ...groups } = layout
  const ids = [...Object.values(groups), ...pages.map((page) => page.sections)].flatMap(
    (sections) => sections?.map((each) => each.id) ?? []
  )
  const twice = ids.find((id, index) => ids.indexOf(id) !== index)
  if (twice) {
    throw new SectorPackError(`${where}/layout.json: section ${twice} twice`)
  }
  const handles = pages.map((page) => page.page_id.$handle)
  const named = handles.find((handle, index) => handles.indexOf(handle) !== index)
  if (named) {
    throw new SectorPackError(`${where}/layout.json: ${named} laid out twice`)
  }
}

/** One preset's folder read and checked; throws `SectorPackError` naming what is wrong. */
export function readPreset(dir: string, pack: string, code: string): StorefrontPreset {
  const where = `${pack}/${PRESETS_DIR}/${code}`
  if (!PRESET_CODE.test(code)) {
    throw new SectorPackError(`${where} is not a preset code`)
  }
  for (const entry of entries(dir, where)) {
    const known = entry.isDirectory()
      ? entry.name === PRESET_IMAGES_DIR
      : entry.isFile() && (isFileName(entry.name) || entry.name === PRESET_PREVIEW)
    if (!known) {
      throw new SectorPackError(`${where}/${entry.name} is not a preset file`)
    }
  }
  const missing = REQUIRED.find((name) => !existsSync(join(dir, name)))
  if (missing) {
    throw new SectorPackError(`${where} has no ${missing}`)
  }
  const read = <N extends FileName>(name: N): z.infer<(typeof PRESET_FILES)[N]> | undefined =>
    existsSync(join(dir, name))
      ? (readJsonFile(join(dir, name), `${where}/${name}`, PRESET_FILES[name]) as z.infer<
          (typeof PRESET_FILES)[N]
        >)
      : undefined

  const manifest = read("preset.json")
  const themeSettings = read("theme.json")
  const layout = read("layout.json")
  if (!manifest || !themeSettings || !layout) {
    throw new SectorPackError(`${where} is incomplete`)
  }
  if (manifest.code !== code) {
    throw new SectorPackError(`${where}/preset.json names ${manifest.code}`)
  }
  if (themeSettings.theme !== manifest.theme) {
    throw new SectorPackError(
      `${where}/theme.json is for ${themeSettings.theme}, not ${manifest.theme}`
    )
  }
  checkSectionIds(layout, where)
  const menus = read("menus.json") ?? null
  const demo = read("demo.json") ?? null
  const refs = presetRefs(layout, `${where}/layout.json`)
  if (demo) {
    presetRefs(demo, `${where}/demo.json`, refs)
  }

  const images = readImages(dir, where)
  const paths = new Set(images.map((image) => image.path))
  const absent = [...refs.images].find((path) => !paths.has(path))
  if (absent) {
    throw new SectorPackError(`${where} has no ${absent}`)
  }
  const unused = images.find((image) => !refs.images.has(image.path))
  if (unused) {
    throw new SectorPackError(`${where}/${unused.path} is used nowhere`)
  }
  const credited = manifest.credits.map((credit) => credit.file)
  const uncredited = images.find((image) => !credited.includes(image.path))
  if (uncredited) {
    throw new SectorPackError(`${where}/${uncredited.path} has no credit in preset.json`)
  }
  const stray = credited.find((file, index) => !paths.has(file) || credited.indexOf(file) !== index)
  if (stray) {
    throw new SectorPackError(`${where}/preset.json credits ${stray} twice or for no image`)
  }

  const preview = existsSync(join(dir, PRESET_PREVIEW)) ? PRESET_PREVIEW : null
  if (preview) {
    imageBytes(join(dir, preview), `${where}/${preview}`, PRESET_LIMITS.previewBytes)
  }
  return {
    code: manifest.code,
    version: manifest.version,
    theme: manifest.theme,
    name: manifest.name,
    description: manifest.description,
    tone: manifest.tone,
    family: manifest.family ?? null,
    swatch: manifest.swatch ?? null,
    credits: manifest.credits,
    pack,
    dir,
    theme_settings: themeSettings,
    layout,
    menus,
    demo,
    images,
    preview,
    handles: [...refs.handles].sort(),
  }
}

/** A pack's presets, by code; none without a `presets/` folder. */
export function readPresets(packDir: string, pack: string): StorefrontPreset[] {
  const dir = join(packDir, PRESETS_DIR)
  if (!existsSync(dir)) {
    return []
  }
  const where = `${pack}/${PRESETS_DIR}`
  const folders = entries(dir, where)
  const file = folders.find((entry) => !entry.isDirectory())
  if (file) {
    throw new SectorPackError(`${where}/${file.name} is not a preset folder`)
  }
  if (folders.length > PRESET_LIMITS.presets) {
    throw new SectorPackError(`${where} has over ${String(PRESET_LIMITS.presets)} presets`)
  }
  return folders
    .map((entry) => readPreset(join(dir, entry.name), pack, entry.name))
    .sort((a, b) => a.code.localeCompare(b.code))
}
