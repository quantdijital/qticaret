import type { CardLookView, Translate } from "@qticaret/ui"
import type { StoreThemeSettings } from "@qticaret/types"

/**
 * The tour card's look (adr/0077 Ek "tur kartı"): today's card, each off.
 * A card the shop left so carries no `look`, its view as it was.
 */
export const CARD_LOOK_DEFAULTS: CardLookView = {
  over: false,
  split: false,
  ratingBadge: false,
  arrow: false,
  duration: false,
  perPerson: false,
}

const KEYS = Object.keys(CARD_LOOK_DEFAULTS) as (keyof CardLookView)[]

/**
 * The theme setting's look: the stars' pill only while the stars are
 * shown (it is where they stand, not a second rating).
 */
export function cardLookOf(card: StoreThemeSettings["product_card"]): CardLookView {
  return {
    over: card.text_position === "over" || card.text_position === "over_split",
    split: card.text_position === "over_split",
    ratingBadge: card.show_rating && card.rating_badge,
    arrow: card.arrow,
    duration: card.duration_row,
    perPerson: card.per_person,
  }
}

/** The card's `look` when the shop changed any of it; none for today's card. */
export function cardLook(options: CardLookView | undefined): CardLookView | undefined {
  if (!options || KEYS.every((key) => options[key] === CARD_LOOK_DEFAULTS[key])) {
    return undefined
  }
  return { ...options }
}

/** The longest a card says a tour lasts; the backend sends 1 to 365. */
const MOST_DAYS = 365

/**
 * A tour's length in words: "5 gün • 4 gece", the nights one fewer than
 * the days (a tour's last day is its way home); a day trip "1 gün". Null
 * for anything but a whole number of days from 1 to 365.
 */
export function durationWords(days: unknown, t: Translate): string | null {
  if (typeof days !== "number" || !Number.isInteger(days) || days < 1 || days > MOST_DAYS) {
    return null
  }
  const dayWords = t("booking.card_days", { days })
  return days > 1
    ? t("booking.card_length", {
        days: dayWords,
        nights: t("booking.card_nights", { nights: days - 1 }),
      })
    : dayWords
}
