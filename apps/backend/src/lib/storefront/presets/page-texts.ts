import { LAYOUT_LIMITS } from "../layout-fields"
import type { ContentPageSection } from "../layout-pages"
import { pageSectionId, pageTextSections } from "../page-text"
import type { PageTextSource } from "../page-text"
import type { ShopPage } from "./document"
import { isObject } from "./resolve-section"

/**
 * A ready-made look keeps the shop's page text (adr/0073 Ek 2026-11-19 (2)
 * K6): the look lays a page out, the page's story stays the shop's. Pure:
 * the shop's draft and its pages' mirrors are read beforehand.
 *
 * - **The page's text** is its `article` and `contact` sections: the
 *   other rich texts (`pane`, `with_image`) are the look's design and
 *   come with it, as on the home page.
 * - **The shop has text** when its draft lays the page out with such a
 *   section, or, laying it out without one (a design from before the text
 *   was a section, a page past the design's limit), when the page's
 *   mirror makes one (K1's synthesis: the contact page's `contact`, else
 *   a non-empty text's `article`).
 * - **The shop's text in the look's place:** the look's own text sections
 *   go and the shop's, in their order, stand where the look's first one
 *   stood; a look laying the page out without a text section has the
 *   shop's first, right under the page head, where a page's text stood
 *   before it was a section. A shop with no text takes the look's text.
 * - **Within the page's limit:** past `LAYOUT_LIMITS.page` the look's
 *   last sections go (`dropped`), never the shop's text.
 */

/** A section that is the page's own text, a look's raw one or a stored one. */
export const isShopText = (section: unknown): boolean =>
  isObject(section) &&
  ((section["type"] === "rich_text" && section["variant"] === "article") ||
    section["type"] === "contact")

/** Every section id the design holds, wherever (footer rows included). */
function idsIn(value: unknown, found: Set<string>): Set<string> {
  if (Array.isArray(value)) {
    value.forEach((each) => idsIn(each, found))
  } else if (isObject(value)) {
    if (typeof value["id"] === "string") {
      found.add(value["id"])
    }
    Object.values(value).forEach((each) => idsIn(each, found))
  }
  return found
}

export interface ShopTexts {
  pages: ShopPage[]
  /** The shop's text sections carried over: its own text, not the apply's new work (K2). */
  carried: ContentPageSection[]
  /** The pages whose text was the shop's, by id. */
  kept: string[]
  /** The look's sections left out past a page's limit: `pages.<page id>.<id>`. */
  dropped: string[]
}

/**
 * The look's pages (`withShopPages`' `preset`) with the shop's own text
 * kept on each (K6). `shop` is the draft's pages as stored, `sources` the
 * mirrors of the look's pages the draft holds no text for; `design` the
 * rest of the new design, whose section ids the kept text stays clear of.
 */
export function withShopTexts(
  preset: readonly ShopPage[],
  shop: readonly ShopPage[],
  sources: ReadonlyMap<string, PageTextSource>,
  design: unknown
): ShopTexts {
  const drafts = new Map(shop.map((page) => [page.page_id, page.sections]))
  // Each page's own text first: the look's text sections it replaces free their ids
  const owned = preset.map((page) => {
    const stored = (drafts.get(page.page_id) ?? []).filter(isShopText) as ContentPageSection[]
    const source = sources.get(page.page_id)
    const own =
      stored.length > 0
        ? stored
        : source
          ? pageTextSections(source, new Set<string>()).filter(isShopText)
          : []
    return { page, own }
  })
  const taken = idsIn(
    [
      design,
      owned.map(({ page, own }) =>
        own.length > 0 ? page.sections.filter((section) => !isShopText(section)) : page.sections
      ),
    ],
    new Set<string>()
  )
  const out: ShopTexts = { pages: [], carried: [], kept: [], dropped: [] }
  for (const { page, own } of owned) {
    if (own.length === 0) {
      out.pages.push(page)
      continue
    }
    const texts = own.map((section) => {
      const id = taken.has(section.id)
        ? pageSectionId(page.page_id, `kept:${section.id}`, taken)
        : section.id
      taken.add(id)
      return { ...section, id }
    })
    const first = page.sections.findIndex(isShopText)
    const at = first === -1 ? 0 : first
    const looks = page.sections.filter((section) => !isShopText(section))
    const room = Math.max(LAYOUT_LIMITS.page - texts.length, 0)
    const fits = looks.slice(0, room)
    for (const section of looks.slice(room)) {
      out.dropped.push(`pages.${page.page_id}.${String(isObject(section) ? section["id"] : "?")}`)
    }
    // The look's sections before its first text stay before the shop's
    const before = page.sections.slice(0, at).filter((section) => fits.includes(section))
    const after = fits.filter((section) => !before.includes(section))
    out.pages.push({ page_id: page.page_id, sections: [...before, ...texts, ...after] })
    out.carried.push(...texts)
    out.kept.push(page.page_id)
  }
  return out
}
