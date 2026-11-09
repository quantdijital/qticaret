import "server-only"
import { cache } from "react"
import type { StoreProduct, StoreProductDescription } from "@qticaret/types"
import { isProductPreviewToken } from "@/lib/views/product-preview"
import { withPictures } from "@/lib/views/prose-images"
import { isStoreApiError } from "./errors"
import type { ProductTexts } from "./product-description"
import { storeGet } from "./server"

export interface ProductPreview {
  product: StoreProduct
  texts: ProductTexts
}

const htmlOf = (value: unknown): string | null =>
  typeof value === "string" && value.trim() !== "" ? value : null

/**
 * The draft product a signed link opens (F18), with its descriptions as
 * the live page renders them; null for a link malformed, made before the
 * product's last save, or past its day. Asked fresh, never cached.
 */
export const productPreview = cache(async (token: string): Promise<ProductPreview | null> => {
  if (!isProductPreviewToken(token)) {
    return null
  }
  try {
    const { product, texts } = await storeGet<{
      product: StoreProduct
      texts: StoreProductDescription
    }>(`/store/product-preview/${encodeURIComponent(token)}`)
    const pictured = (html: string | null) => (html ? withPictures(html, texts.images) : null)
    return {
      product,
      texts: {
        description: pictured(htmlOf(texts.html)),
        summary: pictured(htmlOf(texts.summary_html)),
      },
    }
  } catch (error) {
    if (isStoreApiError(error) && error.status === 404) {
      return null
    }
    throw error
  }
})
