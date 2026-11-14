import "server-only"
import { cache } from "react"
import { storefrontSettings } from "@/lib/store-api/requests"
import { currentLayout } from "./layout"
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
    // The framed card's switches (E5): empty stars only where the stars are shown
    framed: {
      hoverImage: card.hover_image,
      deliveryNote: card.delivery_note,
      fullButton: card.full_button,
      emptyStars: card.empty_stars && card.show_rating,
      freeShippingFrom: answer.free_shipping_threshold,
    },
  }
}
