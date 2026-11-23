import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import {
  CATALOG_BOOKING,
  CATALOG_COLLECTIONS,
  GIFT_CARDS,
  PRODUCT_ADDONS,
} from "../../../modules/platform-settings/features"
import type {
  MarketingSettings,
  PromotionSettings,
  ShippingSettings,
  StorefrontSettings,
} from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { fillShopText } from "../../../lib/shop/tokens"
import type { ShopInfoValues } from "../../../lib/shop/tokens"
import { shopInfoValues } from "../../../workflows/shop/info-values"
import type { ShownSettings } from "../../../lib/storefront/layout-settings"
import { storefrontDelivery } from "../../../workflows/storefront/delivery"
import { liveSettings } from "../../../workflows/storefront/layout-shared"
import { roleAnswer } from "../../../lib/storefront/page-roles"
import type { PageRole, RolePage } from "../../../lib/storefront/page-roles"
import { storefrontRolePages } from "../../../workflows/storefront/page-roles"
import { shopMarks } from "../../../workflows/storefront/shop-marks"
import type { ShopMarks } from "../../../workflows/storefront/shop-marks"

/**
 * GET /store/storefront (F18 D3, docs/19 §4): the storefront's frame as the
 * shop wrote it: the announcement bar's lines, the header's links, the
 * footer's columns, the trust strip and the WhatsApp number; and the free
 * shipping threshold (F4.5: `item_total`, KDV in, after discounts) for the
 * cart's "this much more" line; and the flags of what the storefront offers
 * only while on (gift card codes, F4.8; product add-ons, adr/0052; dated
 * products, adr/0076, whose sections show only then, adr/0077 §8); the
 * footer's payment and carrier marks (adr/0046 Ek 2026-11-04), derived from
 * what the shop has set up; when an order leaves and arrives and the
 * same-day dispatch hour (adr/0046 Ek 2026-11-06). The shop's contact and legal details come
 * from `/store/legal-identity`. A `{belirteç}` in the shop's lines stands for
 * its details as they are now (adr/0048).
 */
/**
 * The lines that may stand for the shop's details, filled. The low-stock
 * threshold stays inside: the card facts apply it (adr/0046 Ek 2026-11-04).
 * The trust badges and the colour names are the design's now (adr/0049 Ek
 * 2026-11-06): given here as published, for a storefront that still reads
 * them from this answer.
 */
function filled(
  storefront: StorefrontSettings,
  shared: ShownSettings,
  values: ShopInfoValues,
  roles: Record<PageRole, RolePage | null>
): Omit<StorefrontSettings, "low_stock_threshold"> {
  const fill = (text: string) => fillShopText(text, values)
  const fillOrNull = (text: string | null) => (text === null ? null : fill(text))
  const { hero } = storefront
  return {
    primary_color: storefront.primary_color,
    // The contact page, and the pages the live payment and shipping facts stand beside
    ...roleAnswer(roles),
    color_swatches: shared.color_swatches,
    announcements: storefront.announcements.map(fill),
    trust_badges: shared.trust_badges.map((badge) => ({
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
  const [
    storefront,
    promotions,
    shipping,
    marketing,
    giftCards,
    addons,
    booking,
    collections,
    values,
    marks,
    shared,
  ] = (await Promise.all([
    settings.getSection("storefront"),
    settings.getSection("promotions"),
    settings.getSection("shipping"),
    settings.getSection("marketing"),
    settings.isFeatureEnabled(GIFT_CARDS),
    settings.isFeatureEnabled(PRODUCT_ADDONS),
    settings.isFeatureEnabled(CATALOG_BOOKING),
    settings.isFeatureEnabled(CATALOG_COLLECTIONS),
    shopInfoValues(req.scope),
    shopMarks(req.scope),
    liveSettings(req.scope),
  ])) as unknown as [
    StorefrontSettings,
    PromotionSettings,
    ShippingSettings,
    MarketingSettings,
    boolean,
    boolean,
    boolean,
    boolean,
    ShopInfoValues,
    ShopMarks,
    ShownSettings,
  ]
  // By id, so a page whose address changed keeps its role (adr/0073 Açık kararlar 3)
  const roles = await storefrontRolePages(
    req.scope,
    storefront as unknown as Record<string, unknown>
  )
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({
    storefront: filled(storefront, shared, values, roles),
    // The theme's choices (F18 D11, adr/0053) as the published design holds them, else the
    // theme section with the old main colour (adr/0063 §3); its version stays inside
    theme: shared.theme,
    free_shipping_threshold: promotions.free_shipping_threshold,
    // The product page's "Kargo ve Teslimat" card says these (adr/0046 Ek 2026-11-06)
    delivery: storefrontDelivery(shipping, marketing),
    // What the storefront offers only while the shop has it on (its routes answer 404 otherwise)
    // Dated products (adr/0076): the sections that need them drawn only while on (adr/0077 §8)
    // Collections (`catalog.collections`): their sections' products and links drawn only while on
    features: { gift_cards: giftCards, product_addons: addons, booking, collections },
    // The footer's ways to pay and carriers, as the shop has them set up (adr/0046 Ek 2026-11-04)
    marks,
  })
}
