import type { CardButtonStyle } from "@qticaret/types"

/**
 * A framed card's foot button in the shop's look (adr/0049 Ek 2026-11-15):
 * `solid` filled in the action's colour, `outline` the quiet bordered one
 * filled while the card is pointed at (today's), `text` an underlined word.
 * Kept out of the `"use client"` quick add: the server-drawn framed card
 * calls it for its "Seçenekler" link, and a plain function exported from a
 * client module cannot be called on the server (the page would fail).
 */
export const cardButtonClass = (look: CardButtonStyle): string =>
  look === "solid"
    ? "gf-btn gf-card-btn gf-card-btn--solid"
    : look === "text"
      ? "gf-btn gf-btn--quiet gf-card-btn gf-card-btn--text"
      : "gf-btn gf-btn--quiet gf-card-btn"
