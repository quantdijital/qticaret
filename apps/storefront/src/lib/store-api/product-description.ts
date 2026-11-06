import "server-only"
import { cache } from "react"
import type { StoreProductDescription } from "@qticaret/types"
import { withPictures } from "@/lib/views/prose-images"
import { storeGet } from "./server"

export interface ProductTexts {
  /** The long description's HTML; null: the page shows the plain text paragraphs. */
  description: string | null
  /** The short description's HTML (adr/0055 Ek 2026-11-06); null: none, the headline facts instead. */
  summary: string | null
}

const htmlOf = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/**
 * A product's long and short descriptions as the backend renders their
 * content documents (adr/0055, adr/0019): HTML from the allow-listed
 * schema, safe to print as it is. Asked fresh with the product (a save in
 * the panel shows at once), once per request. Null for a product without
 * one, or when the answer did not come (a 404, a timeout): the page then
 * shows the plain text paragraphs and the headline facts, never nothing.
 */
export const productTexts = cache(async (id: string): Promise<ProductTexts> => {
  try {
    const answer = await storeGet<StoreProductDescription>(
      `/store/products/${encodeURIComponent(id)}/description`
    )
    // Pictures in the texts in their versions, all lazy: the gallery is above them
    const pictured = (html: string | null) => (html ? withPictures(html, answer.images) : null)
    return {
      description: pictured(htmlOf(answer.html)),
      summary: pictured(htmlOf(answer.summary_html)),
    }
  } catch {
    return { description: null, summary: null }
  }
})
