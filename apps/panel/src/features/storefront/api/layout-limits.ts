import { MARQUEE_LIMITS as MARQUEE, MARQUEE_PER_PAGE } from "@qticaret/types"
import type { ShelfColumns } from "@qticaret/types"

// The theme editor's limits (adr/0049)

/** The server's limits, so a mistake shows before the save. */
export const LAYOUT_LIMITS = {
  home: 30,
  product: 12,
  category: 12,
  faq: 12,
  related: 12,
  question: 160,
  answer: 600,
  items: 24,
  slides: 6,
  lines: 5,
  line: 120,
  title: 60,
  eyebrow: 40,
  heading: 90,
  text: 240,
  slideText: 160,
  alt: 300,
  label: 60,
  heroLinks: 2,
  posts: 6,
  reviews: 12,
} as const

/** The Google rating badge's excerpts: none (off) to three (adr/0058 Ek 2026-11-06). */
export const GOOGLE_RATING_LIMITS = { excerpts: { max: 3, on: 2 } } as const

/** A hero slider's slides (adr/0049 Ek 2026-11-06); how long each stays is the scroller kit's speed. */
export const SLIDER_LIMITS = {
  slides: { min: 2, max: 6 },
} as const

/** A best-seller rail's window in days (adr/0049 Ek 2026-11-05): a week to a year, 90 by default. */
export const BEST_SELLER_DAYS = { min: 7, max: 365, default: 90 } as const

/** A product rail's cards in a row on a wide screen (adr/0049 Ek 2026-11-05); 3 by default. */
export const SHELF_COLUMNS: readonly ShelfColumns[] = [3, 4, 5]

/** H17's list, tiles, quick links and picks; the price bands (adr/0049 Ek 2026-11-14, Katalog). */
export { HERO_CATALOG_LIMITS, PRICE_BANDS_LIMITS } from "@qticaret/types"

/** A scrolling strip's items and lines (adr/0049 Ek 2026-11-14 §4.1), and strips a page shows at most. */
export const MARQUEE_LIMITS = { ...MARQUEE, perPage: MARQUEE_PER_PAGE } as const
