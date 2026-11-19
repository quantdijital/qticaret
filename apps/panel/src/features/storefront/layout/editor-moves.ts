import type {
  AnySection,
  CategorySection,
  LayoutDocument,
  Placement,
} from "@/features/storefront/api/layout"
import { findSection, isBodyGroup, placed } from "./sections"
import { bodyOf, categoryBody, isMain, withBody } from "./main-sections"
import { pageSectionsOf, placeOnPage, sideOf, withPageSections } from "./page-layouts"

/**
 * A section moved in its list or to the other side of a page's middle
 * (`editorReducer`'s `move` and `place`): the home and product pages'
 * lists, a category page's two sides of its products, a content page's
 * two sides of its text (adr/0073), the footer group's above its bar.
 */

/** The list with one item moved to `to` (held within it); the same list when nothing moves. */
function reorder<T extends { id: string }>(list: readonly T[], id: string, to: number) {
  const from = list.findIndex((each) => each.id === id)
  const target = Math.max(0, Math.min(to, list.length - 1))
  if (from < 0 || from === target) {
    return list
  }
  const next = [...list]
  const [moved] = next.splice(from, 1) as [T]
  next.splice(target, 0, moved)
  return next
}

export function move(doc: LayoutDocument, id: string, to: number): LayoutDocument {
  const found = findSection(doc, id)
  if (found?.group === "footer" && !isMain(found.section)) {
    // The footer group's sections above its bar (adr/0070 §4): the bar has no place in the order
    const list = doc.footer.filter((section) => !isMain(section))
    const moved = reorder(list, id, to)
    return moved === list ? doc : { ...doc, footer: withBody(doc.footer, moved) }
  }
  if (found?.group === "pages" && found.page !== null) {
    // Above and below the page's text are two lists, as a category page's
    const list = sideOf(doc, found)
    const moved = reorder(list, id, to)
    if (moved === list) {
      return doc
    }
    const others = pageSectionsOf(doc, found.page).filter((each) => !list.includes(each))
    return withPageSections(doc, found.page, [...moved, ...others])
  }
  if (!found || !isBodyGroup(found.group) || isMain(found.section)) {
    return doc
  }
  if (found.group === "category") {
    // Above and below the products are two lists: the section moves within its own
    const { placement } = found.section as CategorySection
    const list = placed(doc.category, placement)
    const moved = reorder(list, id, to)
    if (moved === list) {
      return doc
    }
    const top = placement === "top" ? moved : placed(doc.category, "top")
    const bottom = placement === "bottom" ? moved : placed(doc.category, "bottom")
    return { ...doc, category: withBody(doc.category, [...top, ...bottom]) }
  }
  // The list's places are the body's: the page's main section stays first
  const list: readonly AnySection[] = bodyOf(doc, found.group)
  const moved = reorder(list, id, to)
  return moved === list
    ? doc
    : { ...doc, [found.group]: withBody(doc[found.group] as AnySection[], moved) }
}

export function place(doc: LayoutDocument, id: string, placement: Placement): LayoutDocument {
  const found = findSection(doc, id)
  if (found?.group === "pages") {
    return placeOnPage(doc, found, placement)
  }
  const section = categoryBody(doc).find((each) => each.id === id)
  if (!section || section.placement === placement) {
    return doc
  }
  const others = doc.category.filter((each) => each.id !== id)
  return {
    ...doc,
    category: withBody(doc.category, [
      ...placed(others, "top"),
      { ...section, placement },
      ...placed(others, "bottom"),
    ]),
  }
}
