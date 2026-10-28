import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { FEED_FORMATTERS } from "../../../lib/feeds"
import { parseEnv } from "../../../lib/env"
import { MARKETING_FEEDS_MODULE } from "../../../modules/marketing-feeds"
import { brandOf } from "../../../workflows/messaging/brand"
import type MarketingFeedsModuleService from "../../../modules/marketing-feeds/service"

/**
 * GET /admin/marketing-feeds (F10.8): whether the feeds are on, whether
 * the shop has the storefront domain they link to, each target's address
 * to give Google or Meta, and its latest file.
 */
export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const feeds = req.scope.resolve<MarketingFeedsModuleService>(MARKETING_FEEDS_MODULE)
  const [token, files, brand] = await Promise.all([
    feeds.currentToken(),
    feeds.listFeedFiles({}),
    brandOf(req.scope),
  ])
  const backend = (parseEnv().BACKEND_URL ?? `${req.protocol}://${req.get("host") ?? ""}`).replace(
    /\/+$/,
    ""
  )
  res.json({
    feeds: {
      enabled: token !== null,
      storefront_set: brand.storefrontUrl !== null,
      targets: FEED_FORMATTERS.map(({ target }) => {
        const file = files.find((each) => each.target === target)
        return {
          target,
          url: token ? `${backend}/feeds/${token}/${target}` : null,
          item_count: file?.item_count ?? null,
          generated_at: file?.generated_at ?? null,
        }
      }),
    },
  })
}
