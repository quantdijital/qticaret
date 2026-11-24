import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { storeCategoryCounts } from "../../../workflows/catalog/category-counts"
import { varyOnPublishableKey } from "../../../lib/http/vary"

/**
 * GET /store/category-counts (adr/0049 Ek 2026-11-14 §10 karar 7b): how
 * many products each category the shop shows lists, its shown subcategories'
 * included, published and in the shopper's sales channels (the
 * publishable key's): `{ counts: { [category_id]: number } }`. Counted in
 * one statement for the whole tree and kept a minute; the same for every
 * visitor of a key.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const counts = await storeCategoryCounts(req.scope, req.publishable_key_context.sales_channel_ids)
  res.setHeader("Cache-Control", "public, max-age=60, stale-while-revalidate=60")
  varyOnPublishableKey(res)
  res.json({ counts })
}
