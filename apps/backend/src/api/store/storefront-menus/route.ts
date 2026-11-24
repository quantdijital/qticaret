import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { storeMenus } from "../../../workflows/storefront/menus-read"
import { varyOnPublishableKey } from "../../../lib/http/vary"

/**
 * GET /store/storefront-menus (adr/0049): the storefront's menus, each
 * link with its current name and live path. A link to a record gone or
 * not live, or to a legal text not published, is left out. The storefront
 * gives its own pages and legal texts their addresses.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const menus = await storeMenus(req.scope)
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  varyOnPublishableKey(res)
  res.json({ menus })
}
