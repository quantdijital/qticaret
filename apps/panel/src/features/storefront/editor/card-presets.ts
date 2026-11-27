import type { ThemeSettings } from "@/features/storefront/api/theme"

type Card = ThemeSettings["product_card"]

/** The ready-made card looks (sahip 2026-11-26), in the panel's order. */
export const CARD_PRESETS = ["classic", "modern", "glass"] as const
export type CardPreset = (typeof CARD_PRESETS)[number]

/**
 * What each look sets: only data, the card's own settings; the owner can
 * change any of them afterwards. Classic: the rows under the photo
 * (Patika's card before); Modern: the stars, date and length on the photo,
 * only the name and price under it; Glass: the frosted panel, every photo
 * in turn on hover.
 */
export const CARD_PRESET_VALUES: Record<CardPreset, Partial<Card>> = {
  classic: { style: "plain", meta_place: "below", text_position: "below", density: "compact" },
  modern: { style: "plain", meta_place: "over", text_position: "below", density: "compact" },
  glass: { style: "glass", meta_place: "over", hover_image: true, hover_cycle: true },
}

/**
 * The look the card's settings match, if any: Modern also with its name
 * and price inside the photo (`text_position` over), as its hint offers.
 */
export function cardPresetOf(card: Card): CardPreset | null {
  if (card.style === "glass") {
    return card.meta_place === "over" && card.hover_image && card.hover_cycle ? "glass" : null
  }
  if (card.meta_place === "over") {
    return "modern"
  }
  return card.text_position === "below" && card.density === "compact" ? "classic" : null
}
