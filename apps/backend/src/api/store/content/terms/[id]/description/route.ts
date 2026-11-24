import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { listingDescriptionHtml } from "../../../../../../lib/catalog/listing-description"
import { CONTENT_MODULE } from "../../../../../../modules/content"
import type ContentModuleService from "../../../../../../modules/content/service"
import { postCounts } from "../../../../../../workflows/content/term-reads"

/**
 * GET /store/content/terms/:id/description (adr/0075 Ek 2026-11-24): a
 * blog category's or tag's text as the shop formatted it, rendered on the
 * server, for the foot of its archive; `description_html` null: plain text
 * only (the term list's `description`). A term with no live post is not
 * found, as it is not listed. The same for everyone; kept a minute.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const [term] = await req.scope
    .resolve<ContentModuleService>(CONTENT_MODULE)
    .listContentTerms({ id }, { select: ["id", "description_doc"], take: 1 })
  const live = term ? await postCounts(req.scope, [term.id], { live: true }) : null
  if (!term || (live?.get(term.id) ?? 0) === 0) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.term_unknown")
  }
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({ term_id: term.id, description_html: listingDescriptionHtml(term.description_doc) })
}
