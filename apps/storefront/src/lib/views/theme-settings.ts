import "server-only"
import { cache } from "react"
import { storefrontSettings } from "@/lib/store-api/requests"
import type { CardOptions } from "./product"
import { themeSettings } from "./theme"

/** The shop's theme settings for this request (adr/0053 §B), every field checked. */
export const currentTheme = cache(async () => {
  const answer = await storefrontSettings()
  return themeSettings(answer.theme, answer.storefront.primary_color)
})

/** What the shop's cards show; the brand is left out of the view when the shop hides it. */
export async function cardOptions(): Promise<CardOptions> {
  const settings = await currentTheme()
  return { showBrand: settings.product_card.show_brand }
}
