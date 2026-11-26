import "server-only"
import { cache } from "react"
import { withCountWord } from "@/lib/i18n"
import { storefrontSettings } from "@/lib/store-api/requests"
import { handNoteOf } from "@qticaret/types/hand-note"
import { handFace } from "./accent"
import { currentLayout } from "./layout"
import { cardLookOf } from "./card-look"
import type { CardOptions } from "./product"
import { themeSourceOf } from "./shared-settings"
import { themeSettings } from "./theme"

/**
 * The shop's theme settings for this request (adr/0053 §B), every field
 * checked: the published design's, a preview's draft on its address
 * (adr/0063 §3).
 */
export const currentTheme = cache(async () => {
  const [layout, answer] = await Promise.all([currentLayout(), storefrontSettings()])
  return themeSettings(...themeSourceOf(layout, answer))
})

/** The words for this request, a product count in the shop's own word (`withCountWord`). */
export const shopWords = cache(async () =>
  withCountWord((await currentTheme()).listing_page?.count_word)
)

/**
 * Whether a section's hand note is drawn in the shop's accent face: the
 * theme is read only for a section that has a note.
 */
export async function noteInHand(note: unknown): Promise<boolean> {
  return handNoteOf(note) === null ? false : handFace(await currentTheme())
}

/**
 * What the shop's cards show; the brand is left out of the view when the
 * shop hides it, the stars put in only when it asks for them (adr/0062);
 * how they are drawn, a product rail's own variant laid over by the rail
 * (`railCards`).
 */
export async function cardOptions(): Promise<CardOptions> {
  const [settings, answer] = await Promise.all([currentTheme(), storefrontSettings()])
  const card = settings.product_card
  return {
    showBrand: card.show_brand,
    showRating: card.show_rating,
    variant: card.variant,
    // The second photo on hover, on every variant (sahip 2026-11-18)
    hoverImage: card.hover_image,
    // Every photo in turn (sahip 2026-11-26), only beside the second
    hoverCycle: card.hover_image && card.hover_cycle,
    // Every card's pills and rows (adr/0049 Ek 2026-11-15): the no-reviews row only where the stars are shown
    shown: {
      saleBadge: card.sale_badge,
      lowStockBadge: card.low_stock_badge,
      soldOutBadge: card.sold_out_badge,
      soldOutRow: card.sold_out_row,
      noReviews: card.show_rating ? card.no_reviews : "hide",
    },
    // The framed card's switches (E5)
    framed: {
      deliveryNote: card.delivery_note,
      fullButton: card.full_button,
      buttonStyle: card.button_style,
      freeShippingFrom: answer.free_shipping_threshold,
    },
    // The quick view button (adr/0049 Ek 2026-11-15): none while the shop has it off
    quickView: card.quick_view ? card.quick_view_trigger : null,
    // The tour card's look (adr/0077 Ek "tur kartı"); a dated card's rows only on a dated card
    look: cardLookOf(card),
  }
}
