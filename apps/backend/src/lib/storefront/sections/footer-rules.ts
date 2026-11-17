import type { FooterSection } from "../layout-sections"
import { footerBlocksOf } from "./footer-rows"
import type { FooterBlock } from "./footer-blocks"
import type { FooterRow } from "./footer-rows"

/**
 * What the whole document asks of a `free_rows` footer (adr/0070 §2, §4),
 * beside the rows' own bounds: ids unique with the sections', and one
 * newsletter form to a page.
 */

/** The footer group's rows while its bar is drawn as `free_rows`; none otherwise. */
export function freeRowsOf(footer: readonly FooterSection[]): FooterRow[] {
  return footer.flatMap((section) =>
    section.type === "footer_bar" && section.variant === "free_rows" ? section.rows : []
  )
}

/** The rows' blocks in the design's order (row by row, column by column). */
export const freeBlocksOf = (footer: readonly FooterSection[]): FooterBlock[] =>
  footerBlocksOf(freeRowsOf(footer))

/** The ids the rows and their blocks take in the document, beside the sections'. */
export const freeRowIds = (footer: readonly FooterSection[]): string[] => {
  const rows = freeRowsOf(footer)
  return [...rows.map((row) => row.id), ...footerBlocksOf(rows).map((block) => block.id)]
}

/**
 * What a `free_rows` footer cannot stand beside in its group, as the
 * answer's key; null: nothing. A newsletter block with a visible
 * newsletter section would put two forms on every page
 * (`footer_newsletter_twice`); a visible `in_footer` box has no column of
 * the bar's to sit in there, its place is a block (`section_invalid`).
 */
export function freeRowsConflict(footer: readonly FooterSection[]): string | null {
  const free = footer.some(
    (section) => section.type === "footer_bar" && section.variant === "free_rows"
  )
  const box = footer.find((section) => section.type === "newsletter" && section.visible)
  if (!free || box?.type !== "newsletter") {
    return null
  }
  if (freeBlocksOf(footer).some((block) => block.type === "newsletter")) {
    return "storefront_layout.footer_newsletter_twice"
  }
  return box.variant === "in_footer" ? "storefront_layout.section_invalid" : null
}
