import type { ContentPageSectionType } from "@qticaret/types"
import type { HomeSection, Placement } from "@/features/storefront/api/layout-sections"

/**
 * A content page's own layout in the theme editor's document (adr/0073
 * §1): the pages the shop writes in İçerik (Hakkımızda, İletişim, a new
 * one) take sections above their text (`top`) or below it (`bottom`), as
 * a category page's stand around its products. The page's head and its
 * text are not sections and are not stored. Keyed by the page's id, so the
 * layout follows a new address; a page whose last section goes leaves the
 * group (a page has no empty layout).
 */

/** A section of a content page: one of the home page's types the page takes, with its place. */
export type ContentPageSection = Extract<HomeSection, { type: ContentPageSectionType }> & {
  placement: Placement
}

export interface PageLayout {
  /** The content page's id (`cnt_…`, `kind: page`). */
  page_id: string
  /** One to twelve sections, above the page's text first, then below it. */
  sections: ContentPageSection[]
}
