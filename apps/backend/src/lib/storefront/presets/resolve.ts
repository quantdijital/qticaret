import { LAYOUT_LIMITS } from "../layout-fields"
import type { MenuInput, MenuLinkInput } from "../menus"
import { resolveMenus } from "./resolve-menus"
import type { PresetMenuInput } from "./resolve-menus"
import { isObject, resolveSection, text } from "./resolve-section"

/**
 * A storefront preset's references resolved for this shop (adr/0063 §2,
 * §4): `{ "$handle": "category:cakilar" }` becomes the record's id,
 * `{ "$href": "/cakilar" }` a link, `{ "$image": "images/hero.webp" }` an
 * image of the shop's media library. One walk over the whole document
 * (`resolveSection`); the section schemas are not written a second time,
 * the result goes through `layoutDocument` as the editor's save does.
 *
 * What cannot be resolved is left out, never stood in for: a missing item
 * of a list (`category_ids`, a hero's buttons) is taken out; a list of
 * records the preset filled and the shop has none of, or a section's one
 * record (`product_id`, a rail's `category_id`), drops the section; a
 * button's single link (`more`, a slide's `link`) and a price band's
 * category (`OPTIONAL_IN_ITEMS`) are cleared; a menu
 * whose every link is gone leaves the set, the shop's live menu kept in its
 * place (`resolveMenus`), never an empty menu put live; a content page's
 * layout (adr/0073 §4) whose page the shop has not made, or that the
 * design has no room for, is left out whole: a preset never makes a page.
 * Each is named in `skipped`.
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
  /**
   * The content pages the draft lays out now, by id (kept unless the preset
   * replaces them, `withShopPages`): a page the preset would add past
   * `LAYOUT_LIMITS.pages` is left out, never the whole look refused.
   */
  laid_out?: readonly string[]
}

export interface SkippedRef {
  /**
   * `home.kategoriler` (a section), `pages.hakkimizda.yorumlar` (a content
   * page's section), `menus.main` (a menu), `menus` (the set), `pages` (a
   * content page's layout, the shop having no such page).
   */
  where: string
  /** The reference as the preset wrote it: `category:cakilar`, `/cakilar`, `page:hakkimizda`; a menu left out by its place, `main`. */
  ref: string
  /** A menu left out: the shop's live menu in its place was kept. */
  kept_live?: boolean
  /** A content page left out: its usual name as the preset gives it (`Hakkımızda`), for the panel to say. */
  name?: string
  /** Why a content page's layout was left out: the shop has no such page, or no room for another layout. */
  reason?: "missing" | "limit"
}

export interface PresetGroups {
  header: unknown[]
  home: unknown[]
  footer: unknown[]
  product: unknown[]
  category: unknown[]
}

export const PRESET_GROUPS = ["header", "home", "footer", "product", "category"] as const

/** A content page's layout resolved: the shop's page by its id, the sections that stand. */
export interface PresetPage {
  page_id: string
  sections: unknown[]
}

export interface ResolvedPreset {
  groups: PresetGroups
  /** The content pages the preset lays out that the shop has, in the preset's order. */
  pages: PresetPage[]
  menus: unknown[] | null
  skipped: SkippedRef[]
  /** Sections left out, `home.kategoriler`, `pages.hakkimizda.yorumlar`. */
  dropped: string[]
  /** Images the resolved design still shows, by path: the ones to bring into the library. */
  images: string[]
}

/** A preset's design as read: its groups and its content pages' layouts. */
export type PresetLayoutInput = Partial<
  Record<(typeof PRESET_GROUPS)[number] | "pages", readonly unknown[] | undefined>
>

const sectionId = (section: unknown): string =>
  isObject(section) && typeof section["id"] === "string" ? section["id"] : "?"

interface Report {
  lookups: PresetLookups
  skipped: SkippedRef[]
  dropped: string[]
  images: Set<string>
}

/** The sections that stand; one that cannot is named in `dropped` (`<where>.<id>`). */
function standing(sections: readonly unknown[], where: string, report: Report): unknown[] {
  return sections.flatMap((section) => {
    const at = `${where}.${sectionId(section)}`
    const shown = new Set<string>()
    const { lookups, skipped } = report
    const resolved = resolveSection(section, { lookups, where: at, skipped, images: shown })
    if (resolved === null) {
      report.dropped.push(at)
      return []
    }
    shown.forEach((path) => report.images.add(path))
    return [resolved]
  })
}

/**
 * The content pages' layouts on the shop's own pages (adr/0073 §4), each
 * left out with its sections and named in `skipped` under `pages` when the
 * shop has not made the page (`missing`; a draft page counts as made) or
 * the design has no room for another page's layout (`limit`: the draft's
 * own layouts stay, warn don't block). One whose every section went is
 * left out too (a page has no empty layout).
 */
function resolvePages(pages: readonly unknown[], report: Report): PresetPage[] {
  const laidOut = new Set(report.lookups.laid_out ?? [])
  let room = LAYOUT_LIMITS.pages - laidOut.size
  return pages.flatMap((page) => {
    const entry = isObject(page) ? page : {}
    const ref = text(isObject(entry["page_id"]) ? entry["page_id"]["$handle"] : null) ?? "?"
    const name = text(entry["name"])
    const leftOut = (reason: "missing" | "limit") => {
      report.skipped.push({ where: "pages", ref, ...(name === null ? {} : { name }), reason })
      return []
    }
    const id = report.lookups.records.get(ref)
    if (id === undefined) {
      return leftOut("missing")
    }
    const added = !laidOut.has(id)
    if (added && room <= 0) {
      return leftOut("limit")
    }
    const listed = Array.isArray(entry["sections"]) ? entry["sections"] : []
    const sections = standing(listed, `pages.${ref.slice(ref.indexOf(":") + 1)}`, report)
    if (sections.length === 0) {
      return []
    }
    if (added) {
      room -= 1
    }
    return [{ page_id: id, sections }]
  })
}

/**
 * The preset's design and menus with every reference resolved, what was
 * left out and why. Pure: the lookups are read beforehand
 * (`presetLookups`); a section dropped takes its images with it.
 */
export function resolvePreset(
  layout: PresetLayoutInput,
  menus: readonly PresetMenuInput[] | null,
  lookups: PresetLookups
): ResolvedPreset {
  const report: Report = { lookups, skipped: [], dropped: [], images: new Set() }
  const groups: PresetGroups = { header: [], home: [], footer: [], product: [], category: [] }
  for (const group of PRESET_GROUPS) {
    groups[group] = standing(layout[group] ?? [], group, report)
  }
  const pages = resolvePages(layout.pages ?? [], report)
  return {
    groups,
    pages,
    menus: menus ? resolveMenus(menus, lookups.links, lookups.live ?? [], report.skipped) : null,
    skipped: report.skipped,
    dropped: report.dropped,
    images: [...report.images].sort(),
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
