import { sectionQuery } from "@/features/settings/api/sections"
import type { SectionResponse } from "@/features/settings/api/sections"

/**
 * The `product_badges` settings section: the small badge on a product
 * card's photo, each kind on its own switch, all off at first. A card
 * shows one: the product's own line > "Çok satan" > "Yeni".
 */
export interface ProductBadgeSettings {
  manual_enabled: boolean
  new_enabled: boolean
  /** "Yeni" on a product added within this many days (1–365). */
  new_days: number
  best_seller_enabled: boolean
  /** "Çok satan" on a product sold at least this many units in 30 days (1–100 000). */
  best_seller_min_units: number
}

/** A product's own badge at most, as the server keeps it. */
export const PRODUCT_BADGE_MAX = 24

const GRAPHEMES = new Intl.Segmenter("tr", { granularity: "grapheme" })

/** A badge's length as the server counts it: letters as a reader sees them, ends cut. */
export const badgeLength = (text: string): number =>
  Array.from(GRAPHEMES.segment(text.trim().replace(/\s+/gu, " "))).length

export const NEW_DAYS_MAX = 365
export const BEST_SELLER_MIN_MAX = 100_000

export const productBadgesQuery = () => sectionQuery<ProductBadgeSettings>("product_badges")

/** Whether the product page offers its own badge field; a backend before the section answers no. */
export function manualBadgesOn(answer: SectionResponse<ProductBadgeSettings> | undefined): boolean {
  const values = answer?.values as Partial<ProductBadgeSettings> | undefined
  return values?.manual_enabled === true
}
