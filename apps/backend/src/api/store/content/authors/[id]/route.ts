import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { authorPostCounts, authorsByIds } from "../../../../../workflows/content/author-reads"
import { storeAuthorDetail } from "../../authors"

/**
 * `GET /store/content/authors/:id` (adr/0060): a blog author's page, as
 * resolve found it: who, their photo, bio and links, and how many live
 * posts they have (the storefront lists them with `?author=`). Their
 * staff account is never shown.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const id = req.params["id"] ?? ""
  const row = (await authorsByIds(req.scope, [id])).get(id)
  if (!row) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.author_unknown")
  }
  const [author, live] = await Promise.all([
    storeAuthorDetail(req.scope, row),
    authorPostCounts(req.scope, [id], { live: true }),
  ])
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({ author: { ...author, post_count: live.get(id) ?? 0 } })
}
