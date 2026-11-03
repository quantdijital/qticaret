import type { MedusaResponse, MedusaStoreRequest } from "@medusajs/framework/http"
import { shortLines } from "../../../../workflows/payment-links/pricing"
import { storeLink } from "../../../../workflows/payment-links/store-link"
import { linesOf, publicLinkView } from "../../../../workflows/payment-links/views"
import { privatePage } from "../private-page"

/**
 * GET /store/payment-links/:token (adr/0051 §3): what the link offers, for
 * the storefront's `/ode/<token>` page. Reading it uses nothing up: a mail
 * scanner may open the link. Unknown, ended, paid and canceled links are
 * the same 404.
 */
export async function GET(req: MedusaStoreRequest, res: MedusaResponse): Promise<void> {
  privatePage(res)
  const link = await storeLink(req.scope, req.params["token"] ?? "")
  const short = await shortLines(
    req.scope,
    linesOf(link),
    req.publishable_key_context.sales_channel_ids[0] ?? null
  )
  res.json({ payment_link: publicLinkView(req.scope, link, short) })
}
