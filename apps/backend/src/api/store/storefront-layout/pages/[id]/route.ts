import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { publishedPageLayout } from "../../../../../workflows/storefront/layout-page-read"
import { namedPage } from "../../page-reads"

/**
 * GET /store/storefront-layout/pages/:id (adr/0073 §6): a live content
 * page's own layout as published, shown now (sections showing at this
 * moment, only live records, links and images resolved, the shop's
 * details in place, rails picked for the key's sales channels), each
 * section above the page's text or below it. A page with no layout, or not
 * live, answers `null`: the storefront draws it as before. Held a minute
 * in process; a publication shows at once.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const page = await namedPage(req)
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({
    page: page.live
      ? await publishedPageLayout(req.scope, page.id, req.publishable_key_context.sales_channel_ids)
      : null,
  })
}
