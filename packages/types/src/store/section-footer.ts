/**
 * The footer bar's own settings (adr/0049 Ek 2026-11-15), common to every
 * footer variant: how the shop's profiles show, a row of written ways to
 * pay the shop picks, and a floating "back to top" button. Every setting
 * has a default that draws the footer as before, so a stored design reads
 * as it did (no migration). The contract's list: a new step goes here
 * first, then into the backend's schema (`lib/storefront/sections/
 * footer-bar.ts`, a mirror a test keeps equal), then into the themes. The
 * panel's Turkish names are `storefront.editor.footerBar.<setting>.<step>`.
 *
 * Imports nothing at run time (the storefront takes it from the
 * `@qticaret/types/section-footer` subpath, which Turbopack resolves).
 */
export const FOOTER_BAR_SETTINGS = {
  /**
   * The shop's profiles (its store details' social accounts, `same_as`):
   * written names as before, the networks' glyphs, or not shown.
   */
  social: ["text", "icons", "hidden"],
  /** Which corner the "back to top" button stands in. */
  back_to_top_side: ["right", "left"],
  /** Its face: round or square (the theme's radius). */
  back_to_top_shape: ["round", "square"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FooterBarSetting = keyof typeof FOOTER_BAR_SETTINGS
export type FooterBarStep<S extends FooterBarSetting> = (typeof FOOTER_BAR_SETTINGS)[S][number]

/**
 * The ways to pay a shop may name in its footer, each drawn as its name in
 * a small framed box (never a company's mark), in the order the shop
 * keeps them. None picked: the theme shows the marks of the providers the
 * shop has, as before.
 */
export const PAYMENT_BADGES = [
  "visa",
  "mastercard",
  "troy",
  "amex",
  "bank_transfer",
  "cash_on_delivery",
  "installments",
] as const

export type PaymentBadge = (typeof PAYMENT_BADGES)[number]

/** The networks a theme draws a glyph for; another address shows its first letter. */
export const SOCIAL_NETWORKS = [
  "instagram",
  "facebook",
  "x",
  "youtube",
  "tiktok",
  "whatsapp",
  "linkedin",
  "pinterest",
] as const

export type SocialNetwork = (typeof SOCIAL_NETWORKS)[number]

/** A footer bar saved before these settings, and a new one: the footer as it was drawn. */
export const FOOTER_BAR_DEFAULTS = {
  social: "text",
  payment_badges: [],
  back_to_top: false,
  back_to_top_side: "right",
  back_to_top_shape: "round",
  back_to_top_mobile: true,
} as const satisfies { [S in FooterBarSetting]: FooterBarStep<S> } & {
  payment_badges: readonly PaymentBadge[]
  back_to_top: boolean
  back_to_top_mobile: boolean
}

/** The footer bar's own settings as `GET /store/storefront-layout` prints them. */
export interface StoreFooterBarSettings {
  social: FooterBarStep<"social">
  payment_badges: PaymentBadge[]
  /** A floating button that takes the visitor back to the top; off as before. */
  back_to_top: boolean
  back_to_top_side: FooterBarStep<"back_to_top_side">
  back_to_top_shape: FooterBarStep<"back_to_top_shape">
  /** Shown on a phone too. */
  back_to_top_mobile: boolean
}
