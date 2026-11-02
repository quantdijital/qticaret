import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import type { LayoutDocument } from "../../../lib/storefront/layout"
import { layoutRow } from "../../../workflows/storefront/layout"
import { defaultLayout } from "../../../workflows/storefront/layout-default"
import { storeLayout } from "../../../workflows/storefront/layout-read"

/**
 * GET /store/storefront-layout (adr/0049): the published design (else the
 * default one) as the storefront shows it now: sections showing at this
 * moment, links and images resolved, the shop's details in place.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const row = await layoutRow(req.scope)
  const doc = (row?.published as LayoutDocument | null) ?? (await defaultLayout(req.scope))
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=300")
  res.vary("x-publishable-api-key")
  res.json({ layout: await storeLayout(req.scope, doc) })
}
