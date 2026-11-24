import type { ProgramTag, ProgramVariant } from "@qticaret/types"
import type { ImageView } from "./views"

/**
 * A dated product's program as the theme draws it (adr/0078): its steps
 * in order, each already labelled in the shop's language ("1. Gün",
 * "2. adım" or the shop's own label), its body as HTML the server
 * rendered and escaped, its picture, and its tags as words beside their
 * key (the key picks the icon). Built only when the product has steps: a
 * product without a program has no section (the simple alternative).
 */
export interface ProgramStepView {
  /** "1. Gün", the shop's own label, …: always words. */
  label: string
  title: string
  /** Paragraphs and lists, safe to place as HTML; null: none. */
  bodyHtml: string | null
  image: ImageView | null
  tags: { key: ProgramTag; label: string }[]
}

export interface ProgramSectionView {
  id: string
  type: "program"
  /** The shop's title, else the storefront's ("Program"). */
  title: string
  /**
   * `timeline`: the steps down a line, each open; `accordion`: each step a
   * row that opens on its own (a button with `aria-expanded`), the first
   * open. One the theme does not draw reads as `timeline`.
   */
  variant: ProgramVariant
  steps: ProgramStepView[]
}
