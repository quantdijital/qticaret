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
  ratio: (typeof CARD_RATIOS)[number]
  show_brand: boolean
  show_rating: boolean
  /** Everywhere's card; a product rail may draw its own (`card_variant`). */
  variant: (typeof PRODUCT_CARD_VARIANTS)[number]
  /** The second photo on hover, every card variant's (sahip 2026-11-18; the framed card's E5 before). */
  hover_image: boolean
  /** While `hover_image` is on, every photo in turn under a resting mouse (sahip 2026-11-26). */
  hover_cycle: boolean
  /** A standard card's rows: today's `regular` or `compact` (sahip 2026-11-26). */
  density: (typeof CARD_DENSITIES)[number]
  /**
   * The framed card's own (E5), read wherever a framed card is drawn: the
   * free shipping line, the add button across its foot.
   */
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
  /**
   * The tour card's look (adr/0077 Ek "tur kartı"), each off or today's by
   * default: a standard card's words under or over its photo, the stars as
   * a pill on the photo, a decorative arrow at its foot; a dated card's
   * length row and "kişi başı" after its price.
   */
  text_position: (typeof CARD_TEXT_POSITIONS)[number]
  rating_badge: boolean
  arrow: boolean
  duration_row: boolean
  per_person: boolean
  /** sahip 2026-11-26: a standard card's stars, length and departure on the photo; its frosted panel. */
  meta_place: (typeof CARD_META_PLACES)[number]
  style: (typeof CARD_STYLES)[number]
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
/** A standard card's words (`CARD_TEXT_POSITIONS`): under the photo (today's) or over it. */
export const CARD_TEXT_POSITIONS = ["below", "over", "over_split"] as const
/** A card photo's shape (`CARD_RATIOS`); `4:3` the short, wide one. */
export const CARD_RATIOS = ["4:5", "1:1", "3:4", "4:3"] as const
/** A standard card's rows (`CARD_DENSITIES`): today's first. */
export const CARD_DENSITIES = ["regular", "compact"] as const
/** A standard card's stars, length and departure (`CARD_META_PLACES`): in its rows (today's) or on the photo. */
export const CARD_META_PLACES = ["below", "over"] as const
/** A standard card's frame (`CARD_STYLES`): today's `plain` or the frosted `glass` panel. */
export const CARD_STYLES = ["plain", "glass"] as const

/**
 * The card's defaults, the Grafit look's (adr/0062 §2): today's card. A
 * row or preset written before a field reads it from here.
 */
export const PRODUCT_CARD_DEFAULTS: ProductCardSettings = {
  ratio: "1:1",
  show_brand: true,
  show_rating: false,
  variant: "standard",
  hover_image: true,
  hover_cycle: false,
  density: "regular",
  delivery_note: true,
  full_button: true,
  sale_badge: true,
  low_stock_badge: true,
  sold_out_badge: true,
  sold_out_row: "price",
  no_reviews: "hide",
  button_style: "outline",
  quick_view: false,
  quick_view_trigger: "hover",
  quick_view_rating: true,
  quick_view_summary: true,
  quick_view_quantity: true,
  text_position: "below",
  rating_badge: false,
  arrow: false,
  duration_row: false,
  per_person: false,
  meta_place: "below",
  style: "plain",
}

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
    ratio: z.enum(CARD_RATIOS),
    show_brand: z.boolean(),
    show_rating: z.boolean(),
    variant: z.enum(PRODUCT_CARD_VARIANTS),
    hover_image: z.boolean(),
    hover_cycle: z.boolean(),
    density: choice(CARD_DENSITIES),
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
    text_position: choice(CARD_TEXT_POSITIONS),
    rating_badge: z.boolean(),
    arrow: z.boolean(),
    duration_row: z.boolean(),
    per_person: z.boolean(),
    meta_place: choice(CARD_META_PLACES),
    style: choice(CARD_STYLES),
  })
  .strict()
