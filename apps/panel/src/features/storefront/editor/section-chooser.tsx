import type {
  ContentPageSection,
  LayoutDocument,
  Placement,
} from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  footerMarqueeFull,
  footerTypesLeft,
  newFooterSection,
} from "@/features/storefront/layout/footer-group"
import type { FooterAddType } from "@/features/storefront/layout/footer-group"
import {
  pageMarqueesFull,
  pageOnlyTaken,
  pageSectionsOf,
} from "@/features/storefront/layout/page-layouts"
import {
  idsOf,
  marqueesOn,
  newBodySection,
  newPageText,
  newSectionId,
  priceBandsOn,
} from "@/features/storefront/layout/sections"
import { AddSectionPicker } from "./add-section-picker"
import type { EditorPage } from "./editor-page"

/** Where the chooser adds: a side of a category page's sections, or the footer group (adr/0070 §4). */
export type Adding = Placement | "footer"

/** The chooser's aim: its group, and the section it lands before (null: at the end). */
export interface AddingAt {
  where: Adding
  before: string | null
}

/**
 * The section chooser for the page being edited (a content page: the one
 * picked, adr/0073 §5), or for the footer group, as a step of the side
 * panel: the picked section is added where it was aimed (before a row, or
 * at the end), marked new for the preview and opened. Null when there is
 * nothing to add to (a content page not picked yet).
 */
export function SectionChooser({
  doc,
  page,
  content = null,
  adding,
  onClose,
  onAdded,
  act,
}: {
  doc: LayoutDocument
  page: EditorPage
  /** The content page picked (`page: "content"`). */
  content?: string | null
  adding: AddingAt
  onClose: () => void
  onAdded: (id: string) => void
  act: (action: EditorAction) => void
}) {
  const { where, before } = adding
  const footer = where === "footer"
  const at = before === null ? {} : { before }
  const marqueeFull = footer
    ? footerMarqueeFull(doc)
    : page === "content"
      ? content !== null && pageMarqueesFull(doc, content)
      : marqueesOn(doc, page) >= MARQUEE_LIMITS.perPage
  if (page === "content" && content === null && !footer) {
    return null
  }
  const placement = footer ? "bottom" : where
  return (
    <AddSectionPicker
      page={footer ? "footer" : page === "content" ? "pages" : page}
      footerTypes={footerTypesLeft(doc)}
      placement={placement}
      aimed={before !== null}
      taken={
        page === "content" && content !== null && !footer
          ? pageOnlyTaken(pageSectionsOf(doc, content))
          : new Set<string>()
      }
      marqueeFull={marqueeFull}
      priceBandsFull={page !== "content" && priceBandsOn(doc, page) >= PRICE_BANDS_LIMITS.perPage}
      onBack={onClose}
      onPick={(type) => {
        const id = newSectionId(idsOf(doc))
        // Marked new before it lands, so the preview scrolls to it
        onAdded(id)
        if (footer) {
          act({
            type: "add",
            group: "footer",
            section: newFooterSection(type as FooterAddType, id),
            ...at,
          })
        } else if (page === "content") {
          if (content !== null) {
            act({
              type: "add",
              group: "pages",
              page: content,
              section:
                type === "article"
                  ? newPageText(id)
                  : (newBodySection("pages", type, id) as ContentPageSection),
              ...at,
            })
          }
        } else if (type !== "article") {
          act({
            type: "add",
            group: page,
            section: newBodySection(page, type, id, placement),
            ...at,
          })
        }
      }}
    />
  )
}
