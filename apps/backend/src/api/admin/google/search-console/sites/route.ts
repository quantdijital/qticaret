import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { searchConsoleSites } from "../../../../../workflows/google/search-console"

/** GET /admin/google/search-console/sites: the properties the shop's Google account can read. */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const sites = await searchConsoleSites(req.scope)
  res.json({
    sites: sites.map((site) => ({ site_url: site.siteUrl, permission: site.permission })),
  })
}
