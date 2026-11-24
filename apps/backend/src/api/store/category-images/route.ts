import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeCategoryImages } from "../../../workflows/catalog/category-images"
import { varyOnPublishableKey } from "../../../lib/http/vary"

/**
 * GET /store/category-images (adr/0046 Ek 2026-11-04): the pictures of the
 * categories a shopper may see, for the storefront's category cards and
 * mega menu: the address, its alt text, and its size and versions where
 * the media library knows them. The same for everyone; kept a while.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const images = await storeCategoryImages(req.scope)
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  varyOnPublishableKey(res)
  res.json({ images })
}
