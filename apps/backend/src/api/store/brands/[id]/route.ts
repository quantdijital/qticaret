import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { listingDescriptionHtml } from "../../../../lib/catalog/listing-description"
import { activeBrand, storeBrand } from "../read"

/**
 * `GET /store/brands/:id`: an active brand (F3.11); its page's SEO comes
 * from resolve. Its description document as HTML (adr/0075) as
 * `description_html`, for the foot of its page; null: plain text only
 * (`description`). The same for everyone; kept a minute.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const brand = await activeBrand(req.scope, req.params["id"] ?? "")
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({
    brand: {
      ...storeBrand(brand),
      description_html: listingDescriptionHtml(brand.description_doc),
    },
  })
}
