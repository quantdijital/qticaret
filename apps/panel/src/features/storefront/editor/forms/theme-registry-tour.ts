import { CARD_TEXT_POSITIONS } from "@/features/storefront/api/theme"
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
  "product_card.rating_badge": tourSwitch(
    "rating_badge",
    (theme, variants) =>
      theme.product_card.show_rating && [...variants].some((variant) => variant !== "compact")
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
