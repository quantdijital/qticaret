import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { CONTENT_MODULE } from "../../../../modules/content"
import type ContentModuleService from "../../../../modules/content/service"
import { byRank, postCounts, termView } from "../../../../workflows/content/term-reads"
import type { StoreGetContentTermsType } from "../validators"
import { varyOnPublishableKey } from "../../../../lib/http/vary"

/**
 * `GET /store/content/terms?kind=` (adr/0019 ek 2026-11-03): the blog's
 * categories or tags that file live posts, in the shop's order, each with
 * its archive's path and how many live posts it has. One with none is no
 * page to link to (its archive is noindex and out of the sitemap). Its
 * text is not in the list (adr/0075 Ek 2026-11-24): an archive reads its
 * own from `/store/content/terms/:id/description`.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetContentTermsType>,
  res: MedusaResponse
): Promise<void> {
  const { kind } = req.validatedQuery
  const [terms, live] = await Promise.all([
    req.scope.resolve<ContentModuleService>(CONTENT_MODULE).listContentTerms(kind ? { kind } : {}, {
      select: ["id", "kind", "name", "handle", "rank"],
      take: null,
    }),
    postCounts(req.scope, null, { live: true }),
  ])
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  varyOnPublishableKey(res)
  res.json({
    terms: terms
      .filter((term) => (live.get(term.id) ?? 0) > 0)
      .sort(byRank)
      .map((term) => ({
        ...termView(term),
        kind: term.kind,
        post_count: live.get(term.id) ?? 0,
      })),
  })
}
