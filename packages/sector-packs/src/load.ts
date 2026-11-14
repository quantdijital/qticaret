import { existsSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { z } from "zod"
import { PRESETS_DIR, readPresets } from "./preset-load"
import type { StorefrontPreset } from "./preset-schema"
import { SectorPackError, readJsonFile } from "./read-json"
import { PACK_CODE, PACK_FILES } from "./schema"
import type { LoadedSectorPack, SectorPack, SectorPackSummary } from "./schema"

/**
 * The packs on disk (`packages/sector-packs/packs/<code>/`), read at run
 * time from beside this file: `src/` in development and tests, `dist/` in
 * a built backend (adr/0061 Ek C10), both one folder under the package. A
 * pack is data only; adding one is adding a folder. Nothing here, nor in
 * any caller, branches on a pack's code.
 */

export { SectorPackError } from "./read-json"

export const DEFAULT_PACKS_DIR = join(__dirname, "..", "packs")

type FileName = keyof typeof PACK_FILES

const isFileName = (name: string): name is FileName => Object.hasOwn(PACK_FILES, name)

const readFile = <N extends FileName>(
  dir: string,
  code: string,
  name: N
): z.infer<(typeof PACK_FILES)[N]> | undefined =>
  existsSync(join(dir, name))
    ? (readJsonFile(join(dir, name), `${code}/${name}`, PACK_FILES[name]) as z.infer<
        (typeof PACK_FILES)[N]
      >)
    : undefined

const repeated = (values: readonly string[]): string | undefined =>
  values.find((value, index) => values.indexOf(value) !== index)

/** Handles, keys and the category tree's order: what one file's schema cannot see. */
function checkItems(pack: SectorPack): void {
  const fail = (what: string) => {
    throw new SectorPackError(`${pack.code}: ${what}`)
  }
  const handle = repeated(pack.attribute_templates.map((template) => template.handle))
  if (handle) {
    fail(`attribute template ${handle} twice`)
  }
  for (const template of pack.attribute_templates) {
    const key = repeated(template.definitions.map((definition) => definition.key))
    if (key) {
      fail(`attribute ${template.handle}/${key} twice`)
    }
  }
  const seen = new Set<string>()
  for (const category of pack.categories) {
    if (seen.has(category.handle)) {
      fail(`category ${category.handle} twice`)
    }
    // A parent first: the tree is made in the file's order
    if (category.parent !== undefined && !seen.has(category.parent)) {
      fail(`category ${category.handle}'s parent ${category.parent} is not before it`)
    }
    seen.add(category.handle)
  }
  const flag = repeated(pack.flags.map((preset) => preset.key))
  if (flag) {
    fail(`flag ${flag} twice`)
  }
}

/** One pack's folder read and checked; throws `SectorPackError` naming what is wrong. */
export function readPack(dir: string, code: string): LoadedSectorPack {
  if (!PACK_CODE.test(code)) {
    throw new SectorPackError(`${code} is not a pack code`)
  }
  const stray = readdirSync(dir, { withFileTypes: true }).find(
    // A hidden file (`.DS_Store`) is no pack file either: refused by its name
    (entry) =>
      !(entry.isFile() && isFileName(entry.name)) &&
      !(entry.isDirectory() && entry.name === PRESETS_DIR)
  )
  if (stray) {
    throw new SectorPackError(`${code}/${stray.name} is not a pack file`)
  }
  const manifest = readFile(dir, code, "manifest.json")
  if (!manifest) {
    throw new SectorPackError(`${code} has no manifest.json`)
  }
  if (manifest.code !== code) {
    throw new SectorPackError(`${code}/manifest.json names ${manifest.code}`)
  }
  const pack: LoadedSectorPack = {
    code: manifest.code,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    attribute_templates: readFile(dir, code, "attributes.json") ?? [],
    categories: readFile(dir, code, "categories.json") ?? [],
    flags: readFile(dir, code, "flags.json") ?? [],
    seo: readFile(dir, code, "seo.json") ?? {},
    presets: readPresets(dir, code),
  }
  checkItems(pack)
  return pack
}

const cache = new Map<string, readonly LoadedSectorPack[]>()

/** Every pack under `dir`, by code; read once per process (packs change with a release). */
export function sectorPacks(dir: string = DEFAULT_PACKS_DIR): readonly LoadedSectorPack[] {
  const known = cache.get(dir)
  if (known) {
    return known
  }
  const packs = readdirSync(dir, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && !entry.name.startsWith("."))
    .map((entry) => readPack(join(dir, entry.name), entry.name))
    .sort((a, b) => a.code.localeCompare(b.code))
  cache.set(dir, packs)
  return packs
}

/** The preset of this code in this pack, or null. */
export function storefrontPreset(
  pack: string,
  code: string,
  dir?: string
): StorefrontPreset | null {
  return sectorPack(pack, dir)?.presets.find((preset) => preset.code === code) ?? null
}

/** The pack of this code, or null for one there is none of. */
export function sectorPack(code: string, dir?: string): LoadedSectorPack | null {
  return sectorPacks(dir).find((pack) => pack.code === code) ?? null
}

export const isSectorPackCode = (code: string, dir?: string): boolean =>
  sectorPack(code, dir) !== null

const count = (record: Readonly<Record<string, string>> | undefined): number =>
  record ? Object.keys(record).length : 0

/** What the wizard shows of a pack: its manifest and how many items of each kind. */
export function summaryOf(pack: LoadedSectorPack): SectorPackSummary {
  return {
    code: pack.code,
    version: pack.version,
    name: pack.name,
    description: pack.description,
    counts: {
      attribute_templates: pack.attribute_templates.length,
      attributes: pack.attribute_templates.reduce(
        (sum, template) => sum + template.definitions.length,
        0
      ),
      categories: pack.categories.length,
      flags: pack.flags.length,
      seo_templates: count(pack.seo.title_templates) + count(pack.seo.description_templates),
      presets: pack.presets.length,
    },
  }
}
