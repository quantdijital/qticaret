import type { MenuInput, MenuLinkInput } from "../menus"
import { resolveMenus } from "./resolve-menus"
import type { PresetMenuInput } from "./resolve-menus"

/**
 * A storefront preset's references resolved for this shop (adr/0063 §2,
 * §4): `{ "$handle": "category:cakilar" }` becomes the record's id,
 * `{ "$href": "/cakilar" }` a link, `{ "$image": "images/hero.webp" }` an
 * image of the shop's media library. One walk over the whole document; the
 * section schemas are not written a second time, the result goes through
 * `layoutDocument` as the editor's save does.
 *
 * What cannot be resolved is left out, never stood in for: a missing item
 * of a list (`category_ids`, a hero's buttons) is taken out; a list of
 * records the preset filled and the shop has none of, or a section's one
 * record (`product_id`, a rail's `category_id`), drops the section; a
 * button's single link (`more`, a slide's `link`) is cleared; a menu
 * whose every link is gone leaves the set, the shop's live menu kept in its
 * place (`resolveMenus`), never an empty menu put live. Each is named in
 * `skipped`.
 */

/** A link resolved without its wording: the preset's label goes on it. */
export type PresetLink = Omit<MenuLinkInput, "label">

export interface PresetLookups {
  /** `category:cakilar` → the record's id; a handle the shop has no record for is absent. */
  records: ReadonlyMap<string, string>
  /** An address → its link; null: a path on the shop no record or page answers. */
  links: ReadonlyMap<string, PresetLink | null>
  /** `images/hero.webp` → its address in the media library. */
  images: ReadonlyMap<string, string>
  /** The shop's menus now, as a set writes them: kept where the preset leaves a place (`resolveMenus`). */
  live?: readonly MenuInput[]
}

export interface SkippedRef {
  /** `home.kategoriler` (a section), `menus.main` (a menu), `menus` (the set). */
  where: string
  /** The reference as the preset wrote it: `category:cakilar`, `/cakilar`; a menu left out by its place, `main`. */
  ref: string
  /** A menu left out: the shop's live menu in its place was kept. */
  kept_live?: boolean
}

export interface PresetGroups {
  header: unknown[]
  home: unknown[]
  footer: unknown[]
  product: unknown[]
  category: unknown[]
}

export const PRESET_GROUPS = ["header", "home", "footer", "product", "category"] as const

export interface ResolvedPreset {
  groups: PresetGroups
  menus: unknown[] | null
  skipped: SkippedRef[]
  /** Sections left out, `home.kategoriler`. */
  dropped: string[]
  /** Images the resolved design still shows, by path: the ones to bring into the library. */
  images: string[]
}

/** The value is gone: taken out of its list, or its field cleared. */
const GONE = Symbol("gone")
/** The section cannot stand without it. */
const NO_SECTION = Symbol("no-section")
type Outcome = unknown

/** A field naming one record (`product_id`) or a list of them (`category_ids`). */
const ID_FIELD = /^[a-z]+_(ids?)$/

const isObject = (value: unknown): value is Record<string, unknown> =>
  typeof value === "object" && value !== null && !Array.isArray(value)

const text = (value: unknown): string | null => (typeof value === "string" ? value : null)

interface Walk {
  lookups: PresetLookups
  where: string
  skipped: SkippedRef[]
  images: Set<string>
}

function marker(node: Record<string, unknown>, walk: Walk): Outcome {
  const handle = text(node["$handle"])
  if (handle !== null) {
    const id = walk.lookups.records.get(handle)
    if (id === undefined) {
      walk.skipped.push({ where: walk.where, ref: handle })
      return GONE
    }
    return id
  }
  const href = text(node["$href"])
  if (href !== null) {
    const link = walk.lookups.links.get(href)
    const label = text(node["label"])
    // An address kept as written has no wording of its own (the pack's schema asks one)
    if (!link || (link.kind === "url" && label === null)) {
      walk.skipped.push({ where: walk.where, ref: href })
      return GONE
    }
    return { ...link, label }
  }
  const path = text(node["$image"])
  if (path !== null) {
    const url = walk.lookups.images.get(path)
    if (url === undefined) {
      throw new Error(`preset image ${path} was not brought into the library`)
    }
    walk.images.add(path)
    return { url, alt: text(node["alt"]) }
  }
  return node
}

function resolveList(list: unknown[], key: string | null, walk: Walk): Outcome {
  const out: unknown[] = []
  for (const item of list) {
    const resolved = resolveNode(item, walk)
    if (resolved === NO_SECTION) {
      return NO_SECTION
    }
    if (resolved !== GONE) {
      out.push(resolved)
    }
  }
  // A choice the preset made and the shop has none of: never "every category" instead
  if (key !== null && ID_FIELD.exec(key)?.[1] === "ids" && list.length > 0 && out.length === 0) {
    return NO_SECTION
  }
  return out
}

function resolveNode(node: unknown, walk: Walk, key: string | null = null): Outcome {
  if (Array.isArray(node)) {
    return resolveList(node, key, walk)
  }
  if (!isObject(node)) {
    return node
  }
  if (Object.keys(node).some((name) => name.startsWith("$"))) {
    return marker(node, walk)
  }
  const out: Record<string, unknown> = {}
  for (const [name, child] of Object.entries(node)) {
    const resolved = resolveNode(child, walk, name)
    if (resolved === NO_SECTION) {
      return NO_SECTION
    }
    if (resolved === GONE) {
      // A section's one record is the section; a single link is only cleared
      if (ID_FIELD.exec(name)?.[1] === "id") {
        return NO_SECTION
      }
      out[name] = null
      continue
    }
    out[name] = resolved
  }
  return out
}

const sectionId = (section: unknown): string =>
  isObject(section) && typeof section["id"] === "string" ? section["id"] : "?"

/**
 * The preset's design and menus with every reference resolved, what was
 * left out and why. Pure: the lookups are read beforehand
 * (`presetLookups`); a section dropped takes its images with it.
 */
export function resolvePreset(
  layout: Partial<Record<(typeof PRESET_GROUPS)[number], readonly unknown[] | undefined>>,
  menus: readonly PresetMenuInput[] | null,
  lookups: PresetLookups
): ResolvedPreset {
  const skipped: SkippedRef[] = []
  const dropped: string[] = []
  const images = new Set<string>()
  const groups: PresetGroups = { header: [], home: [], footer: [], product: [], category: [] }
  for (const group of PRESET_GROUPS) {
    for (const section of layout[group] ?? []) {
      const where = `${group}.${sectionId(section)}`
      const shown = new Set<string>()
      const resolved = resolveNode(section, { lookups, where, skipped, images: shown })
      if (resolved === NO_SECTION || resolved === GONE) {
        dropped.push(where)
        continue
      }
      shown.forEach((path) => images.add(path))
      groups[group].push(resolved)
    }
  }
  return {
    groups,
    menus: menus ? resolveMenus(menus, lookups.links, lookups.live ?? [], skipped) : null,
    skipped,
    dropped,
    images: [...images].sort(),
  }
}

/** Every `$handle`, `$href` and `$image` written anywhere in `value`. */
export function presetMarkers(value: unknown): {
  handles: Set<string>
  hrefs: Set<string>
  images: Set<string>
} {
  const found = { handles: new Set<string>(), hrefs: new Set<string>(), images: new Set<string>() }
  const visit = (node: unknown): void => {
    if (Array.isArray(node)) {
      node.forEach(visit)
      return
    }
    if (!isObject(node)) {
      return
    }
    const handle = text(node["$handle"])
    const href = text(node["$href"])
    const image = text(node["$image"])
    if (handle !== null) found.handles.add(handle)
    if (href !== null) found.hrefs.add(href)
    if (image !== null) found.images.add(image)
    // Menus write a link as `{ label, href }`
    if (handle === null && href === null && typeof node["href"] === "string" && "label" in node) {
      found.hrefs.add(node["href"])
    }
    Object.values(node).forEach(visit)
  }
  visit(value)
  return found
}
