import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { shopRating } from "../../../../workflows/customers/shop-rating"
import { visibleReviewed } from "../visible"
import { varyOnPublishableKey } from "../../../../lib/http/vary"

/**
 * GET /store/reviews/summary (adr/0046 Ek 2026-11-05): the shop's approved
 * reviews in short, for the home page's reviews section and the reviews
 * page: the average, how many, how many gave each number of stars. Only
 * products the shopper may see count (published, in the publishable key's
 * sales channels). `rating` is null while none is approved.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  const titles = await visibleReviewed(req.scope, req.publishable_key_context.sales_channel_ids)
  const rating = await shopRating(req.scope, new Set(titles.keys()))
  res.setHeader("Cache-Control", "public, max-age=60")
  varyOnPublishableKey(res)
  res.json({ rating })
}
