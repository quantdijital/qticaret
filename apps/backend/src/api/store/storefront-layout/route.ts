import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { publishedLayout } from "../../../workflows/storefront/layout-read"

/**
 * GET /store/storefront-layout (adr/0049): the published design (else the
 * default one) as the storefront shows it now: sections showing at this
 * moment, links and images resolved, only live records, the shop's
 * details in place. Held a minute in process; a publication shows at once.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({ layout: await publishedLayout(req.scope) })
}
