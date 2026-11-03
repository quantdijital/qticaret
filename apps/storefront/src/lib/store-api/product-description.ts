import "server-only"
import { cache } from "react"
import type { StoreProductDescription } from "@qticaret/types"
import { storeGet } from "./server"

/**
 * A product's long description as the backend renders its content
 * document (adr/0055, adr/0019): HTML from the allow-listed schema, safe
 * to print as it is. Asked fresh with the product (a save in the panel
 * shows at once), once per request. Null when the product has no
 * document, or the answer did not come (a 404, a timeout): the page then
 * shows the plain text paragraphs, never nothing.
 */
export const productDescriptionHtml = cache(async (id: string): Promise<string | null> => {
  try {
    const { html } = await storeGet<StoreProductDescription>(
      `/store/products/${encodeURIComponent(id)}/description`
    )
    return typeof html === "string" && html.trim() !== "" ? html : null
  } catch {
    return null
  }
})
