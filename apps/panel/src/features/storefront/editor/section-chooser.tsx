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
import { pageMarqueesFull } from "@/features/storefront/layout/page-layouts"
import {
  idsOf,
  marqueesOn,
  newBodySection,
  newSectionId,
  priceBandsOn,
} from "@/features/storefront/layout/sections"
import { AddSectionDialog } from "./add-section-dialog"
import type { EditorPage } from "./editor-page"

/** Where the chooser adds: a side of the page's sections, or the footer group (adr/0070 §4). */
export type Adding = Placement | "footer"

/**
 * The section chooser for the page being edited (a content page: the one
 * picked, adr/0073 §5), or for the footer group: the picked section is
 * added, marked new for the preview and opened.
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
  adding: Adding | null
  onClose: () => void
  onAdded: (id: string) => void
  act: (action: EditorAction) => void
}) {
  const footer = adding === "footer"
  const marqueeFull = footer
    ? footerMarqueeFull(doc)
    : page === "content"
      ? content !== null && pageMarqueesFull(doc, content)
      : marqueesOn(doc, page) >= MARQUEE_LIMITS.perPage
  return (
    <AddSectionDialog
      open={adding !== null && (page !== "content" || content !== null || footer)}
      page={footer ? "footer" : page === "content" ? "pages" : page}
      footerTypes={footerTypesLeft(doc)}
      placement={adding === null || footer ? "bottom" : adding}
      marqueeFull={marqueeFull}
      priceBandsFull={page !== "content" && priceBandsOn(doc, page) >= PRICE_BANDS_LIMITS.perPage}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      onPick={(type) => {
        const id = newSectionId(idsOf(doc))
        // Marked new before it lands, so the preview scrolls to it
        onAdded(id)
        const placement = adding === null || footer ? "bottom" : adding
        if (footer) {
          act({
            type: "add",
            group: "footer",
            section: newFooterSection(type as FooterAddType, id),
          })
        } else if (page === "content") {
          if (content !== null) {
            act({
              type: "add",
              group: "pages",
              page: content,
              section: newBodySection("pages", type, id, placement) as ContentPageSection,
            })
          }
        } else {
          act({
            type: "add",
            group: page,
            section: newBodySection(page, type, id, placement),
          })
        }
      }}
    />
  )
}
