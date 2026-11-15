import type { StripGallerySettings, StripSource } from "@qticaret/types"
import type {
  BodySectionBase,
  LayoutImage,
  LayoutLink,
} from "@/features/storefront/api/layout-sections"

// The strip gallery of the theme editor's document (adr/0049 Ek 2026-11-16)

export type { StripSource }

/**
 * One strip: a source (a record, or none: `custom`) and beside it,
 * whatever the source, the shop's own picture, heading, line and link;
 * each left empty takes the source's (its picture, its name, a product's
 * price or a category's count, its page). A `custom` strip needs its
 * picture; its link is optional.
 */
export interface StripItem {
  source: StripSource
  image: LayoutImage | null
  title: string | null
  note: string | null
  link: LayoutLink | null
}

/** Two to eight slanted strips side by side, with an optional heading and line over them. */
export type StripGallerySection = BodySectionBase & {
  type: "strip_gallery"
  title: string | null
  /** May hold the shop's details (`{telefon}`). */
  text: string | null
  /** Two to eight to save. */
  items: StripItem[]
} & StripGallerySettings
