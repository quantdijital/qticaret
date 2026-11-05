import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { PLATFORM_SETTINGS_MODULE } from "../../../modules/platform-settings"
import { GIFT_CARDS, PRODUCT_ADDONS } from "../../../modules/platform-settings/features"
import type {
  PromotionSettings,
  StorefrontSettings,
  ThemeSettings,
} from "../../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../../modules/platform-settings/service"
import { fillShopText } from "../../../lib/shop/tokens"
import type { ShopInfoValues } from "../../../lib/shop/tokens"
import { shopInfoValues } from "../../../workflows/shop/info-values"
import { shopMarks } from "../../../workflows/storefront/shop-marks"
import type { ShopMarks } from "../../../workflows/storefront/shop-marks"

/**
 * GET /store/storefront (F18 D3, docs/19 §4): the storefront's frame as the
 * shop wrote it: the announcement bar's lines, the header's links, the
 * footer's columns, the trust strip and the WhatsApp number; and the free
 * shipping threshold (F4.5: `item_total`, KDV in, after discounts) for the
 * cart's "this much more" line; and the flags of what the storefront offers
 * only while on (gift card codes, F4.8; product add-ons, adr/0052); the
 * footer's payment and carrier marks (adr/0046 Ek 2026-11-04), derived from
 * what the shop has set up. The shop's contact and legal details come
 * from `/store/legal-identity`. A `{belirteç}` in the shop's lines stands for
 * its details as they are now (adr/0048).
 */
/**
 * The lines that may stand for the shop's details, filled. The low-stock
 * threshold stays inside: the card facts apply it (adr/0046 Ek 2026-11-04).
 */
function filled(
  storefront: StorefrontSettings,
  values: ShopInfoValues
): Omit<StorefrontSettings, "low_stock_threshold"> {
  const fill = (text: string) => fillShopText(text, values)
  const fillOrNull = (text: string | null) => (text === null ? null : fill(text))
  const { hero } = storefront
  return {
    primary_color: storefront.primary_color,
    contact_form_path: storefront.contact_form_path,
    // The pages the storefront shows the live payment and shipping facts beside
    payment_info_path: storefront.payment_info_path,
    shipping_info_path: storefront.shipping_info_path,
    color_swatches: storefront.color_swatches,
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

/**
 * The theme's choices (F18 D11, adr/0053). Its main colour falls back to the
 * storefront section's `primary_color` until the panel writes it here; that
 * field stays in `storefront` meanwhile.
 */
const themeOf = (theme: ThemeSettings, storefront: StorefrontSettings): ThemeSettings => ({
  ...theme,
  colors: { ...theme.colors, primary: theme.colors.primary ?? storefront.primary_color },
})

export async function GET(req: MedusaRequest, res: MedusaResponse): Promise<void> {
  const settings = req.scope.resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
  const [storefront, promotions, theme, giftCards, addons, values, marks] = (await Promise.all([
    settings.getSection("storefront"),
    settings.getSection("promotions"),
    settings.getSection("theme"),
    settings.isFeatureEnabled(GIFT_CARDS),
    settings.isFeatureEnabled(PRODUCT_ADDONS),
    shopInfoValues(req.scope),
    shopMarks(req.scope),
  ])) as unknown as [
    StorefrontSettings,
    PromotionSettings,
    ThemeSettings,
    boolean,
    boolean,
    ShopInfoValues,
    ShopMarks,
  ]
  res.setHeader("Cache-Control", "public, max-age=300, stale-while-revalidate=3600")
  res.vary("x-publishable-api-key")
  res.json({
    storefront: filled(storefront, values),
    theme: themeOf(theme, storefront),
    free_shipping_threshold: promotions.free_shipping_threshold,
    // What the storefront offers only while the shop has it on (its routes answer 404 otherwise)
    features: { gift_cards: giftCards, product_addons: addons },
    // The footer's ways to pay and carriers, as the shop has them set up (adr/0046 Ek 2026-11-04)
    marks,
  })
}
