import type { BodyGroup, PageGroup } from "@/features/storefront/api/layout"

/**
 * The pages the theme editor covers (adr/0049 §6.3, adr/0073 §5): the
 * home page, every product page, every category page (their templates),
 * and one content page of İçerik at a time, with its own layout.
 */
export type EditorPage = BodyGroup | "content"

/** In the bar's page choice, in its order. */
export const EDITOR_PAGES: readonly EditorPage[] = ["home", "product", "category", "content"]

/** The document group a page's own sections are in. */
export const groupOfPage = (page: EditorPage): PageGroup => (page === "content" ? "pages" : page)

/**
 * The page shown, as a section on it is told from one elsewhere: a
 * template's group, or the content page picked (null: none picked yet).
 */
export type ShownPage = BodyGroup | { content: string | null }

export const shownPage = (page: EditorPage, content: string | null): ShownPage =>
  page === "content" ? { content } : page

/** Whether a section of `group` (on content page `onPage`) is the shown page's own. */
export function onShownPage(
  shown: ShownPage,
  group: string,
  onPage: string | null | undefined
): boolean {
  if (typeof shown === "string") {
    return group === shown
  }
  return group === "pages" && shown.content !== null && onPage === shown.content
}

/** A content page's id as İçerik gives it (`cnt_…`), as the editor's address may carry it. */
export const CONTENT_PAGE_ID = /^cnt_[0-9A-Za-z]{1,40}$/

/** The bare path of a page reached in the preview: no query nor fragment, no trailing slash. */
export const barePath = (path: string): string => {
  const [bare = ""] = path.split(/[?#]/)
  return bare.length > 1 ? bare.replace(/\/+$/, "") : bare
}
