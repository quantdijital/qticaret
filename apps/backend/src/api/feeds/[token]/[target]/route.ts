import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { feedFormatterOf } from "../../../../lib/feeds"
import { MARKETING_FEEDS_MODULE } from "../../../../modules/marketing-feeds"
import type MarketingFeedsModuleService from "../../../../modules/marketing-feeds/service"

/**
 * GET /feeds/:token/:target (F10.8, adr/0038 §3): the shop's latest feed
 * for Google, Meta and the like, which fetch it by address alone. The
 * token, compared in constant time, keeps the catalog's prices from
 * anyone without the address; a wrong one and a missing feed look alike.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
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
