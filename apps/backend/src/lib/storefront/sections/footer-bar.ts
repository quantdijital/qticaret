import { z } from "@medusajs/framework/zod"

/**
 * The footer bar's own settings (adr/0049 Ek 2026-11-15), the same in
 * every footer variant: how the shop's profiles show (its store details'
 * `same_as`, checked there: https only), the ways to pay the shop names
 * (written, never a company's mark) and a floating "back to top" button.
 * Each default draws the footer as before, so a stored design reads as it
 * did and prints as it did (`footerSettingsOf`).
 *
 * Mirrors `@qticaret/types`' `FOOTER_BAR_SETTINGS`, `PAYMENT_BADGES` and
 * `FOOTER_BAR_DEFAULTS` (the backend reads no runtime value from that
 * package); a unit test keeps them equal.
 */
export const FOOTER_BAR_SETTINGS = {
  social: ["text", "icons", "hidden"],
  back_to_top_side: ["right", "left"],
  back_to_top_shape: ["round", "square"],
} as const

export const PAYMENT_BADGES = [
  "visa",
  "mastercard",
  "troy",
  "amex",
  "bank_transfer",
  "cash_on_delivery",
  "installments",
] as const

export const FOOTER_BAR_DEFAULTS = {
  social: "text",
  payment_badges: [],
  back_to_top: false,
  back_to_top_side: "right",
  back_to_top_shape: "round",
  back_to_top_mobile: true,
} as const

type Setting = keyof typeof FOOTER_BAR_SETTINGS
type PaymentBadge = (typeof PAYMENT_BADGES)[number]

const FOOTER_ERROR = { error: "storefront_layout.section_invalid" }

const step = <S extends Setting>(setting: S) =>
  z
    .custom<(typeof FOOTER_BAR_SETTINGS)[S][number]>(
      (value) => (FOOTER_BAR_SETTINGS[setting] as readonly unknown[]).includes(value),
      FOOTER_ERROR
    )
    .default(FOOTER_BAR_DEFAULTS[setting])

const badge = z.custom<PaymentBadge>(
  (value) => (PAYMENT_BADGES as readonly unknown[]).includes(value),
  FOOTER_ERROR
)

/** The fields every footer variant's branch spreads in. */
export const footerBarFields = {
  social: step("social"),
  /** In the shop's order, each once. */
  payment_badges: z
    .array(badge)
    .max(PAYMENT_BADGES.length)
    .refine((list) => new Set(list).size === list.length, FOOTER_ERROR)
    .default([]),
  back_to_top: z.boolean().default(FOOTER_BAR_DEFAULTS.back_to_top),
  back_to_top_side: step("back_to_top_side"),
  back_to_top_shape: step("back_to_top_shape"),
  back_to_top_mobile: z.boolean().default(FOOTER_BAR_DEFAULTS.back_to_top_mobile),
}

export interface FooterBarSettings {
  social: (typeof FOOTER_BAR_SETTINGS)["social"][number]
  payment_badges: PaymentBadge[]
  back_to_top: boolean
  back_to_top_side: (typeof FOOTER_BAR_SETTINGS)["back_to_top_side"][number]
  back_to_top_shape: (typeof FOOTER_BAR_SETTINGS)["back_to_top_shape"][number]
  back_to_top_mobile: boolean
}

/** A footer read in or saved before the settings: the defaults, a list of its own. */
export const footerBarDefaults = (): FooterBarSettings => ({
  ...FOOTER_BAR_DEFAULTS,
  payment_badges: [],
})

/**
 * The settings as the storefront reads them: only those the shop changed,
 * so a footer left as it was prints as before (a reader fills the rest
 * from the contract's defaults).
 */
export function footerSettingsOf(footer: FooterBarSettings): Partial<FooterBarSettings> {
  const set: Partial<FooterBarSettings> = {}
  if (footer.social !== FOOTER_BAR_DEFAULTS.social) set.social = footer.social
  if (footer.payment_badges.length > 0) set.payment_badges = [...footer.payment_badges]
  if (footer.back_to_top) {
    set.back_to_top = true
    set.back_to_top_side = footer.back_to_top_side
    set.back_to_top_shape = footer.back_to_top_shape
    set.back_to_top_mobile = footer.back_to_top_mobile
  }
  return set
}
