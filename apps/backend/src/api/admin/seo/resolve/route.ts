import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { resolveStorefrontPath } from "../../../../workflows/seo/redirects/resolve"
import type { AdminGetSeoResolveType } from "../redirects/validators"

/** Where a path goes now, as the storefront would be told; tries count no hits. */
export async function GET(
  req: MedusaRequest<unknown, AdminGetSeoResolveType>,
  res: MedusaResponse
): Promise<void> {
  const { path } = req.validatedQuery as AdminGetSeoResolveType
  res.json({ resolution: await resolveStorefrontPath(req.scope, path, { countHits: false }) })
}
