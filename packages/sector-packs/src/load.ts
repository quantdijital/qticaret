import { existsSync, readFileSync, readdirSync } from "node:fs"
import { join } from "node:path"
import type { z } from "zod"
import { PACK_CODE, PACK_FILES } from "./schema"
import type { SectorPack, SectorPackSummary } from "./schema"

/**
 * The packs on disk (`packages/sector-packs/packs/<code>/`), read at run
 * time from beside this file: `src/` in development and tests, `dist/` in
 * a built backend (adr/0061 Ek C10), both one folder under the package. A
 * pack is data only; adding one is adding a folder. Nothing here, nor in
 * any caller, branches on a pack's code.
 */

/** A pack that does not read as one: its code, file and what is wrong. */
export class SectorPackError extends Error {
  constructor(message: string) {
    super(`sector pack: ${message}`)
    this.name = "SectorPackError"
  }
}

export const DEFAULT_PACKS_DIR = join(__dirname, "..", "packs")

type FileName = keyof typeof PACK_FILES

const isFileName = (name: string): name is FileName => Object.hasOwn(PACK_FILES, name)

function readFile<N extends FileName>(
  dir: string,
  code: string,
  name: N
): z.infer<(typeof PACK_FILES)[N]> | undefined {
  const path = join(dir, name)
  if (!existsSync(path)) {
    return undefined
  }
  let raw: unknown
  try {
    raw = JSON.parse(readFileSync(path, "utf8"))
  } catch {
    throw new SectorPackError(`${code}/${name} is not JSON`)
  }
  const parsed = PACK_FILES[name].safeParse(raw)
  if (!parsed.success) {
    const issue = parsed.error.issues[0]
    throw new SectorPackError(
      `${code}/${name} ${issue?.path.map(String).join(".") ?? ""}: ${issue?.message ?? ""}`
    )
  }
  return parsed.data as z.infer<(typeof PACK_FILES)[N]>
}

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
export function readPack(dir: string, code: string): SectorPack {
  if (!PACK_CODE.test(code)) {
    throw new SectorPackError(`${code} is not a pack code`)
  }
  const stray = readdirSync(dir).find((name) => !name.startsWith(".") && !isFileName(name))
  if (stray) {
    throw new SectorPackError(`${code}/${stray} is not a pack file`)
  }
  const manifest = readFile(dir, code, "manifest.json")
  if (!manifest) {
    throw new SectorPackError(`${code} has no manifest.json`)
  }
  if (manifest.code !== code) {
    throw new SectorPackError(`${code}/manifest.json names ${manifest.code}`)
  }
  const pack: SectorPack = {
    code: manifest.code,
    version: manifest.version,
    name: manifest.name,
    description: manifest.description,
    attribute_templates: readFile(dir, code, "attributes.json") ?? [],
    categories: readFile(dir, code, "categories.json") ?? [],
    flags: readFile(dir, code, "flags.json") ?? [],
    seo: readFile(dir, code, "seo.json") ?? {},
  }
  checkItems(pack)
  return pack
}

const cache = new Map<string, readonly SectorPack[]>()

/** Every pack under `dir`, by code; read once per process (packs change with a release). */
export function sectorPacks(dir: string = DEFAULT_PACKS_DIR): readonly SectorPack[] {
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

/** The pack of this code, or null for one there is none of. */
export function sectorPack(code: string, dir?: string): SectorPack | null {
  return sectorPacks(dir).find((pack) => pack.code === code) ?? null
}

export const isSectorPackCode = (code: string, dir?: string): boolean =>
  sectorPack(code, dir) !== null

const count = (record: Readonly<Record<string, string>> | undefined): number =>
  record ? Object.keys(record).length : 0

/** What the wizard shows of a pack: its manifest and how many items of each kind. */
export function summaryOf(pack: SectorPack): SectorPackSummary {
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
    },
  }
}
