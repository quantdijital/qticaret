import { z } from "@medusajs/framework/zod"
import { isPlainObject } from "./define"

/** The product card's settings in the theme section (adr/0053, adr/0049 Ek 2026-11-14 and 2026-11-15). */

/**
 * How a product card is drawn (adr/0049 Ek 2026-11-14 §3.3): `standard`
 * today's card, `framed` the bordered box (UK5), `compact` the small
 * side-by-side card (Ek 2026-11-15). Mirrors `@qticaret/types`'
 * `CARD_VARIANTS` (a unit test keeps them equal); a product rail's
 * `card_variant` takes the same list.
 */
export const PRODUCT_CARD_VARIANTS = ["standard", "framed", "compact"] as const

export interface ProductCardSettings {
  ratio: "4:5" | "1:1" | "3:4"
  show_brand: boolean
  show_rating: boolean
  /** Everywhere's card; a product rail may draw its own (`card_variant`). */
  variant: (typeof PRODUCT_CARD_VARIANTS)[number]
  /**
   * The framed card's own (E5), read wherever a framed card is drawn: the
   * second photo on hover, the free shipping line, the add button across
   * its foot, empty stars without reviews.
   */
  hover_image: boolean
  delivery_note: boolean
  full_button: boolean
  /** The pills on the photo, each the shop's (adr/0049 Ek 2026-11-15, decision a). */
  sale_badge: boolean
  low_stock_badge: boolean
  sold_out_badge: boolean
  /** A sold-out card's price row (decision b). */
  sold_out_row: (typeof CARD_SOLD_OUT_ROWS)[number]
  /** The stars' place on a product without reviews (decision c); replaced `empty_stars`. */
  no_reviews: (typeof CARD_NO_REVIEWS)[number]
  /** The framed card's foot button (decision d). */
  button_style: (typeof CARD_BUTTON_STYLES)[number]
  /** The quick view (adr/0049 Ek 2026-11-15): off by default, as cards were. */
  quick_view: boolean
  quick_view_trigger: (typeof CARD_QUICK_VIEW_TRIGGERS)[number]
  /** What the quick view dialog shows besides the photos, name, price and options. */
  quick_view_rating: boolean
  quick_view_summary: boolean
  quick_view_quantity: boolean
}

/**
 * The card's lists (adr/0049 Ek 2026-11-15), the contract's
 * (`@qticaret/types` `CARD_SOLD_OUT_ROWS`, `CARD_NO_REVIEWS`,
 * `CARD_BUTTON_STYLES`); each list's default is today's card.
 */
export const CARD_SOLD_OUT_ROWS = ["price", "text", "notify"] as const
export const CARD_NO_REVIEWS = ["hide", "empty_stars", "write_first"] as const
export const CARD_BUTTON_STYLES = ["solid", "outline", "text"] as const
/** The quick view button (`CARD_QUICK_VIEW_TRIGGERS`): on hover, or an icon always. */
export const CARD_QUICK_VIEW_TRIGGERS = ["hover", "icon"] as const

const CHOICE_ERROR = { error: "platform_settings.invalid" }

/**
 * A choice off a closed list refused with the error key (a custom check,
 * as Medusa's answer reads an enum's issue as a missing field and drops
 * the key, `storefront/sections/look.ts`). No default: a patch leaves the
 * stored value alone, a stored row without it takes the section's.
 */
const choice = <T extends string>(list: readonly T[]) => {
  const listed: readonly unknown[] = list
  return z.custom<T>((value) => listed.includes(value), CHOICE_ERROR)
}

/**
 * A card written with the framed card's `empty_stars` switch read as the
 * no-reviews choice that replaced it: on, empty stars; off, nothing. The
 * switch drew only on the framed card, so on another variant (or none
 * stored) on reads as nothing: a saved shop looks as it did. A card that
 * has both keys keeps its choice. Anything else as it is.
 */
export function upgradeCard(card: unknown): unknown {
  if (!isPlainObject(card) || !Object.hasOwn(card, "empty_stars")) {
    return card
  }
  const { empty_stars: emptyStars, ...rest } = card
  return Object.hasOwn(rest, "no_reviews")
    ? rest
    : {
        ...rest,
        no_reviews: emptyStars === true && rest["variant"] === "framed" ? "empty_stars" : "hide",
      }
}

/** The card's fields as the theme section checks them. */
export const productCardSchema = z
  .object({
    ratio: z.enum(["4:5", "1:1", "3:4"]),
    show_brand: z.boolean(),
    show_rating: z.boolean(),
    variant: z.enum(PRODUCT_CARD_VARIANTS),
    hover_image: z.boolean(),
    delivery_note: z.boolean(),
    full_button: z.boolean(),
    sale_badge: z.boolean(),
    low_stock_badge: z.boolean(),
    sold_out_badge: z.boolean(),
    sold_out_row: choice(CARD_SOLD_OUT_ROWS),
    no_reviews: choice(CARD_NO_REVIEWS),
    button_style: choice(CARD_BUTTON_STYLES),
    quick_view: z.boolean(),
    quick_view_trigger: choice(CARD_QUICK_VIEW_TRIGGERS),
    quick_view_rating: z.boolean(),
    quick_view_summary: z.boolean(),
    quick_view_quantity: z.boolean(),
  })
  .strict()
