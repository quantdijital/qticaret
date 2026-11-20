import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { publishedPageLayout } from "../../../../../workflows/storefront/layout-page-read"
import { livePageId } from "../../page-reads"

/**
 * GET /store/storefront-layout/pages/:id (adr/0073 §6): a live content
 * page's own layout as published, shown now (sections showing at this
 * moment, only live records, links and images resolved, the shop's
 * details in place, rails picked for the key's sales channels), in its
 * order, the page's text among them (adr/0073 Ek 2026-11-19 (2) K1). A
 * live page the design has no entry for is answered with its text as
 * sections (`synthesized`); every page not to be seen (a draft, a deleted
 * one, a post, none such) answers `null` alike. Held a minute in process;
 * a publication shows at once.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  const id = await livePageId(req)
  res.json({
    page: id
      ? await publishedPageLayout(req.scope, id, req.publishable_key_context.sales_channel_ids)
      : null,
  })
}
