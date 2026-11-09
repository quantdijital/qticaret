import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { productPreview } from "../../../../lib/content/preview-token"
import { orderAccessKey } from "../../../../lib/orders/access-token"
import { previewProductPage, previewedProduct } from "./read"

/**
 * GET /store/product-preview/:token (F18): a draft product's page as it
 * will read, for the storefront's preview page; only with a link staff
 * made in the last day, and only while the product is as it was then.
 * Never cached, never indexed.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "no-store")
  res.setHeader("X-Robots-Tag", "noindex, nofollow")
  const parts = productPreview.parts(req.params["token"] ?? "")
  const product = parts ? await previewedProduct(req.scope, parts.entryId) : null
  if (!parts || !product || !productPreview.opens(orderAccessKey(), parts, product.updated_at)) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  const page = await previewProductPage(
    req.scope,
    product.id,
    req.publishable_key_context.sales_channel_ids[0] ?? null
  )
  if (!page) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
  }
  res.json(page)
}
