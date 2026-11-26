import {
  CARD_DENSITIES,
  CARD_META_PLACES,
  CARD_STYLES,
  CARD_TEXT_POSITIONS,
} from "@/features/storefront/api/theme"
import type {
  DATED_CARD_SWITCHES,
  ThemeChoices,
  TOUR_CARD_SWITCHES,
} from "@/features/storefront/api/theme"
import type { CardVariantsInUse, FieldMeta, ShopFlags } from "./theme-registry"

/**
 * The tour card's fields (adr/0077 Ek "tur kartı") as the theme panel and
 * its search know them, kept beside the registry (`theme-registry.ts`)
 * that spreads them in. Each field is hidden where it means nothing: the
 * words' place and the arrow on a standard card only, the stars' pill
 * while the stars are shown, a dated card's length and "kişi başı" only
 * while the shop sells dated products (`catalog.booking`).
 */

const C = "storefront.editor.theme"

/** The flag a dated card's fields need (adr/0076). */
export const DATED_FLAG = "catalog.booking"

/** "tur", "kart" find every tour card field. */
const KEYWORDS = `${C}.tourCard.words`

const standardInUse = (_theme: ThemeChoices, variants: CardVariantsInUse) =>
  variants.has("standard")

const tourSwitch = (
  name: (typeof TOUR_CARD_SWITCHES)[number] | (typeof DATED_CARD_SWITCHES)[number],
  shown: (theme: ThemeChoices, variants: CardVariantsInUse, flags: ShopFlags) => boolean
): FieldMeta => ({
  group: "card",
  label: `${C}.tourCard.${name}`,
  keywords: KEYWORDS,
  shown,
})

export const TOUR_CARD_META = {
  "product_card.text_position": {
    group: "card",
    label: `${C}.tourCard.text_position`,
    options: CARD_TEXT_POSITIONS.map((option) => `${C}.tourCard.textPositions.${option}`),
    keywords: KEYWORDS,
    shown: standardInUse,
  },
  // sahip 2026-11-26: the price right under the name, the stars, count and length on one line
  "product_card.density": {
    group: "card",
    label: `${C}.tourCard.density`,
    options: CARD_DENSITIES.map((option) => `${C}.tourCard.densities.${option}`),
    keywords: KEYWORDS,
    shown: standardInUse,
  },
  // sahip 2026-11-26: the stars, date and length as frosted pills on the photo
  "product_card.meta_place": {
    group: "card",
    label: `${C}.tourCard.meta_place`,
    options: CARD_META_PLACES.map((option) => `${C}.tourCard.metaPlaces.${option}`),
    keywords: KEYWORDS,
    shown: standardInUse,
  },
  // sahip 2026-11-26: the name and price on a frosted panel floating on the photo
  "product_card.style": {
    group: "card",
    label: `${C}.tourCard.style`,
    options: CARD_STYLES.map((option) => `${C}.tourCard.styles.${option}`),
    keywords: KEYWORDS,
    shown: standardInUse,
  },
  "product_card.rating_badge": tourSwitch(
    "rating_badge",
    // A standard card with its details on the photo or a glass panel carries the stars itself
    (theme, variants) =>
      theme.product_card.show_rating &&
      [...variants].some(
        (variant) =>
          variant !== "compact" &&
          !(
            variant === "standard" &&
            (theme.product_card.meta_place === "over" || theme.product_card.style === "glass")
          )
      )
  ),
  "product_card.arrow": tourSwitch(
    "arrow",
    (theme, variants) =>
      standardInUse(theme, variants) && theme.product_card.text_position === "below"
  ),
  "product_card.duration_row": tourSwitch("duration_row", (_theme, _variants, flags) =>
    flags.has(DATED_FLAG)
  ),
  "product_card.per_person": tourSwitch("per_person", (_theme, _variants, flags) =>
    flags.has(DATED_FLAG)
  ),
} satisfies Record<string, FieldMeta>
