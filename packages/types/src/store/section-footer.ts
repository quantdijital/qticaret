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
  social: ["text", "icons", "hidden", "bare"],
  /** Which corner the "back to top" button stands in. */
  back_to_top_side: ["right", "left"],
  /** Its face: round or square (the theme's radius). */
  back_to_top_shape: ["round", "square"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FooterBarSetting = keyof typeof FOOTER_BAR_SETTINGS
export type FooterBarStep<S extends FooterBarSetting> = (typeof FOOTER_BAR_SETTINGS)[S][number]

/**
 * The ways to pay a shop may name in its footer, in the order the shop
 * keeps them: the ledger draws each as its name in a small framed box;
 * `brand_columns` draws a card network by its own mark (the storefront's
 * `public/marks`), the others by their name. None picked: the theme shows
 * the marks of the providers the shop has, as before.
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

/**
 * The `brand_columns` footer's own settings (adr/0049 Ek 2026-11-17), kept
 * only while the footer is drawn as it: its ground (the look's names:
 * "Hafif ton / Sayfa / Koyu", the steel well first) and how the ways to
 * pay stand (each mark on its own small white card, or straight on the
 * ground; on the dark ground always on cards, a mark needs its light).
 * Mirrored by the backend's `FOOTER_COLUMNS_SETTINGS`; a test keeps them equal.
 */
export const FOOTER_COLUMNS_SETTINGS = {
  ground: ["well", "page", "stage"],
  badge_style: ["card", "plain"],
  /** The newsletter box under the brand block, or as the row's last column. */
  news_place: ["brand", "column"],
  /** The address, phone and e-mail in the brand block, or only its logo, line and profiles. */
  brand_contact: ["show", "hide"],
  /** The bottom line spread across the page, or its words in the middle between two rules. */
  bottom_align: ["spread", "center"],
  /** The shop's name once more under the bottom line, very large and faint, cut by the footer's edge (`on`), or none. */
  wordmark: ["off", "on"],
} as const satisfies Record<string, readonly [string, ...string[]]>

export type FooterColumnsSetting = keyof typeof FOOTER_COLUMNS_SETTINGS
export type FooterColumnsStep<S extends FooterColumnsSetting> =
  (typeof FOOTER_COLUMNS_SETTINGS)[S][number]

/** The short line under the shop's name, at most this many characters. */
export const FOOTER_COLUMNS_LIMITS = { about: 240 } as const

/** A footer switched to `brand_columns` starts with these. */
export const FOOTER_COLUMNS_DEFAULTS = {
  /** The strip above the columns: the newsletter box and the shop's ways to reach it. */
  top_strip: true,
  about: null,
  ground: "well",
  badge_style: "card",
  news_place: "brand",
  brand_contact: "show",
  bottom_align: "spread",
  wordmark: "off",
} as const satisfies { [S in FooterColumnsSetting]: FooterColumnsStep<S> } & {
  top_strip: boolean
  about: null
}

/** The `brand_columns` footer's own settings as `GET /store/storefront-layout` prints them. */
export interface StoreFooterColumns {
  top_strip: boolean
  /** A short line about the shop under its name; null: none. */
  about: string | null
  ground: FooterColumnsStep<"ground">
  badge_style: FooterColumnsStep<"badge_style">
  /** Printed only when not the default; absent: `brand`. */
  news_place?: FooterColumnsStep<"news_place">
  /** Printed only when not the default; absent: `show`. */
  brand_contact?: FooterColumnsStep<"brand_contact">
  /** Printed only when not the default; absent: `spread`. */
  bottom_align?: FooterColumnsStep<"bottom_align">
  /** Printed only when not the default; absent: `off`. */
  wordmark?: FooterColumnsStep<"wordmark">
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
