import type { StoreLayoutImage } from "./layout.js"
import type { NewsletterVariant } from "./section-variants.js"

/**
 * The newsletter box's own fields (adr/0049 Ek 2026-11-17 e-bülten). The
 * meaning of `text` does not change: it stays the consent sentence, the
 * box's label (İYS, double opt-in). What the visitor reads beside the
 * heading is a new field, `description`, common to every variant so it
 * survives a switch (the standard drawing never shows it, so a stored box
 * draws as it did). `note` (a small promise under it, "Ayda birkaç
 * e-posta · İstediğiniz an ayrılın") and its switch are `split`'s and
 * `image_card`'s; `image` (one of the media library's) is `image_card`'s.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-newsletter` subpath, which Turbopack resolves).
 * Mirrored by the backend's `sections/newsletter.ts`; a test keeps them equal.
 */
export const NEWSLETTER_LIMITS = { description: 240, note: 80 } as const

/** The variants only the footer's box takes: a page's box has no footer column to sit in. */
export const NEWSLETTER_FOOTER_ONLY = ["in_footer"] as const satisfies readonly NewsletterVariant[]

/** The variants that show the small promise line (`note`, `show_note`). */
export const NEWSLETTER_NOTE_VARIANTS = [
  "split",
  "image_card",
] as const satisfies readonly NewsletterVariant[]

/** Whether the variant draws the promise line. */
export const newsletterHasNote = (variant: NewsletterVariant): boolean =>
  (NEWSLETTER_NOTE_VARIANTS as readonly string[]).includes(variant)

/** Whether a page's box (not the footer's) may take the variant. */
export const newsletterOnPage = (variant: NewsletterVariant): boolean =>
  !(NEWSLETTER_FOOTER_ONLY as readonly string[]).includes(variant)

/**
 * The newsletter box as the store API prints it, on a page or in the
 * footer: today's `title` and `text` (the consent sentence), then each new
 * field only off its default, so a box from before the variants prints as
 * it did. The storefront reads a variant it does not know as `standard`
 * (`variantOf`) and a missing field as its default.
 */
export interface StoreNewsletterSection {
  id: string
  type: "newsletter"
  title: string | null
  text: string | null
  /** Absent: `standard`. */
  variant?: NewsletterVariant
  /** The shop's line beside the heading; absent or null: the theme's own words (none on `standard`, which never draws it). */
  description?: string | null
  /** `split`, `image_card`: the shop's promise line; absent or null: the storefront's. */
  note?: string | null
  /** `split`, `image_card`: false hides the promise line; absent: shown. */
  show_note?: boolean
  /** `image_card`: the picture, filled from the media library; absent or null: drawn as `split`. */
  image?: StoreLayoutImage | null
}
