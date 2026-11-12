import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { feedFormatterOf } from "../../../../lib/feeds"
import { PLAN_SUSPENDED_MESSAGE, planModeFor } from "../../../../lib/plan-guard"
import { MARKETING_FEEDS_MODULE } from "../../../../modules/marketing-feeds"
import type MarketingFeedsModuleService from "../../../../modules/marketing-feeds/service"
import { SUSPENDED_RETRY_AFTER_SECONDS } from "../../../http/plan-guard"
import { rejectRequest } from "../../../http/reject"

/**
 * GET /feeds/:token/:target (F10.8, adr/0038 §3): the shop's latest feed
 * for Google, Meta and the like, which fetch it by address alone. The
 * token, compared in constant time, keeps the catalog's prices from
 * anyone without the address; a wrong one and a missing feed look alike.
 * A suspended shop's feeds answer 503 with `Retry-After`, as its checkout
 * and storefront do (adr/0061 §5.5, Ek C19 L1): no product of it is
 * offered anew.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  if ((await planModeFor(req.scope)) === "suspended") {
    res.setHeader("Retry-After", String(SUSPENDED_RETRY_AFTER_SECONDS))
    rejectRequest(
      req,
      res,
      503,
      { type: "unavailable", message: PLAN_SUSPENDED_MESSAGE },
      "plan_suspended_feed"
    )
    return
  }
  const formatter = feedFormatterOf(req.params["target"] ?? "")
  const feeds = req.scope.resolve<MarketingFeedsModuleService>(MARKETING_FEEDS_MODULE)
  const [file] =
    formatter && (await feeds.opens(req.params["token"] ?? ""))
      ? await feeds.listFeedFiles({ target: formatter.target }, { take: 1 })
      : []
  if (!formatter || !file) {
    throw new MedusaError(MedusaError.Types.NOT_FOUND, "marketing_feeds.unknown")
  }
  const body = await req.scope.resolve(Modules.FILE).getAsBuffer(file.file_key)
  res.setHeader("Content-Type", formatter.contentType)
  res.setHeader("X-Robots-Tag", "noindex")
  res.setHeader("Cache-Control", "private, max-age=300")
  res.setHeader("Last-Modified", new Date(file.generated_at).toUTCString())
  res.status(200).send(body)
}
