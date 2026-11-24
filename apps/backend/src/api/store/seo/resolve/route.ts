import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveStorefrontPath } from "../../../../workflows/seo/redirects/resolve"
import type { StoreGetSeoResolveType } from "../validators"
import { varyOnPublishableKey } from "../../../../lib/http/vary"

/**
 * `GET /store/seo/resolve?path=` (docs/13 §4): what the storefront does
 * with a path: show a page, redirect (the end of any chain, in one hop),
 * answer 410 or 404. Shared caches may keep the answer a minute; a rule
 * saved reaches visitors within that.
 */
export async function GET(
  req: MedusaRequest<unknown, StoreGetSeoResolveType>,
  res: MedusaResponse
): Promise<void> {
  const { path } = req.validatedQuery as StoreGetSeoResolveType
  const resolution = await resolveStorefrontPath(req.scope, path, { cache: true })
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  // Added to CORS's `Vary: Origin`, not in its place
  varyOnPublishableKey(res)
  res.json(resolution)
}
