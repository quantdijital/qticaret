import type { LayoutDocument } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import { BODY_GROUPS, marqueesOn, priceBandsOn } from "./sections"
import { marqueesOnPage } from "./page-layouts"

/**
 * The scrolling strips of a page showing more than it may (adr/0049 Ek
 * 2026-11-14 §4.1): the header's, the footer group's (adr/0070 §4) and the
 * page's, each marked, by id; and
 * the price bands strips of a page with more than two.
 */
export function marqueeLimitIds(doc: LayoutDocument): Set<string> {
  const ids = new Set<string>()
  for (const page of BODY_GROUPS) {
    if (marqueesOn(doc, page) > MARQUEE_LIMITS.perPage) {
      for (const section of [...doc.header, ...doc.footer, ...doc[page]]) {
        if (section.type === "marquee") ids.add(section.id)
      }
    }
  }
  // A content page's own strips count with the header's and the footer's (adr/0073 §1)
  for (const page of doc.pages) {
    if (marqueesOnPage(doc, page.page_id) > MARQUEE_LIMITS.perPage) {
      for (const section of [...doc.header, ...doc.footer, ...page.sections]) {
        if (section.type === "marquee") ids.add(section.id)
      }
    }
  }
  for (const page of BODY_GROUPS) {
    if (priceBandsOn(doc, page) > PRICE_BANDS_LIMITS.perPage) {
      for (const section of doc[page]) {
        if (section.type === "price_bands") ids.add(section.id)
      }
    }
  }
  return ids
}
