import type { BodyGroup, LayoutDocument, Placement } from "@/features/storefront/api/layout"
import { MARQUEE_LIMITS, PRICE_BANDS_LIMITS } from "@/features/storefront/api/layout"
import type { EditorAction } from "@/features/storefront/layout/editor-state"
import {
  footerMarqueeFull,
  footerTypesLeft,
  newFooterSection,
} from "@/features/storefront/layout/footer-group"
import type { FooterAddType } from "@/features/storefront/layout/footer-group"
import {
  idsOf,
  marqueesOn,
  newBodySection,
  newSectionId,
  priceBandsOn,
} from "@/features/storefront/layout/sections"
import { AddSectionDialog } from "./add-section-dialog"

/** Where the chooser adds: a side of the page's sections, or the footer group (adr/0070 §4). */
export type Adding = Placement | "footer"

/**
 * The section chooser for the page being edited, or for the footer group:
 * the picked section is added, marked new for the preview and opened.
 */
export function SectionChooser({
  doc,
  page,
  adding,
  onClose,
  onAdded,
  act,
}: {
  doc: LayoutDocument
  page: BodyGroup
  adding: Adding | null
  onClose: () => void
  onAdded: (id: string) => void
  act: (action: EditorAction) => void
}) {
  const footer = adding === "footer"
  return (
    <AddSectionDialog
      open={adding !== null}
      page={footer ? "footer" : page}
      footerTypes={footerTypesLeft(doc)}
      placement={adding === null || footer ? "bottom" : adding}
      marqueeFull={
        footer ? footerMarqueeFull(doc) : marqueesOn(doc, page) >= MARQUEE_LIMITS.perPage
      }
      priceBandsFull={priceBandsOn(doc, page) >= PRICE_BANDS_LIMITS.perPage}
      onOpenChange={(open) => {
        if (!open) {
          onClose()
        }
      }}
      onPick={(type) => {
        const id = newSectionId(idsOf(doc))
        // Marked new before it lands, so the preview scrolls to it
        onAdded(id)
        if (footer) {
          act({
            type: "add",
            group: "footer",
            section: newFooterSection(type as FooterAddType, id),
          })
        } else {
          act({
            type: "add",
            group: page,
            section: newBodySection(page, type, id, adding ?? "bottom"),
          })
        }
      }}
    />
  )
}
