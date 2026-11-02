import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { GIFT_CARDS } from "../../../modules/platform-settings/features"
import type {
  PromotionSettings,
  StorefrontSettings,
} from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { fillShopText } from "../../../lib/shop/tokens"
import type { ShopInfoValues } from "../../../lib/shop/tokens"
import { shopInfoValues } from "../../../workflows/shop/info-values"

/**
 * GET /store/storefront (F18 D3, docs/19 §4): the storefront's frame as the
 * shop wrote it: the announcement bar's lines, the header's links, the
 * footer's columns, the trust strip and the WhatsApp number; and the free
 * shipping threshold (F4.5: `item_total`, KDV in, after discounts) for the
 * cart's "this much more" line; and the flags of what the storefront offers
 * only while on (gift card codes, F4.8). The shop's contact and legal details come
 * from `/store/legal-identity`. A `{belirteç}` in the shop's lines stands for
 * its details as they are now (adr/0048).
 */
/** The lines that may stand for the shop's details, filled. */
function filled(storefront: StorefrontSettings, values: ShopInfoValues): StorefrontSettings {
  const fill = (text: string) => fillShopText(text, values)
  const fillOrNull = (text: string | null) => (text === null ? null : fill(text))
  const { hero } = storefront
  return {
    ...storefront,
    announcements: storefront.announcements.map(fill),
    trust_badges: storefront.trust_badges.map((badge) => ({
      ...badge,
      title: fill(badge.title),
      text: fillOrNull(badge.text),
    })),
    hero: hero
      ? {
          ...hero,
          eyebrow: fillOrNull(hero.eyebrow),
          heading: fill(hero.heading),
          text: fillOrNull(hero.text),
        }
      : null,
  }
}

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const settings = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [storefront, promotions, giftCards, values] = (await Promise.all([
    settings.getSection("storefront"),
    settings.getSection("promotions"),
    settings.isFeatureEnabled(GIFT_CARDS),
    shopInfoValues(req.scope),
  ])) as unknown as [StorefrontSettings, PromotionSettings, boolean, ShopInfoValues]
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({
    storefront: filled(storefront, values),
    free_shipping_threshold: promotions.free_shipping_threshold,
    // What the storefront offers only while the shop has it on (its routes answer 404 otherwise)
    features: { gift_cards: giftCards },
  })
}
