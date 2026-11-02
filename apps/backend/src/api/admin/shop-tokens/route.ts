import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { SHOP_INFO_TOKENS } from "../../../lib/shop/tokens"
import { shopInfoValues } from "../../../workflows/shop/info-values"

/**
 * GET /admin/shop-tokens (adr/0048): the `{belirteç}`s a text in the panel
 * may stand in for, each with what it shows now: the panel's "insert a
 * detail" menu and its "as the storefront shows it" line. Public details
 * only (the shop's name, its contact details, the free shipping threshold).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const values = await shopInfoValues(req.scope)
  res.json({ tokens: SHOP_INFO_TOKENS.map((name) => ({ name, value: values[name] })) })
}
