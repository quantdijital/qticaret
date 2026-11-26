import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import type { InventorySettings } from "../../modules/platform-settings/sections"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import type { ListingPlan } from "../../modules/search-index/types"

/**
 * T1: whether the shop's listings leave sold-out products out
 * (`inventory.out_of_stock_listing`, default `show`). "Sold out" is the
 * search index's `in_stock`: no variant sellable now, a variant whose
 * stock is not tracked or that sells past stock always counting as in
 * stock (`workflows/search/source.ts`). The product's own page, its
 * structured data (`OutOfStock`) and the sitemap are not touched.
 */
export async function hidesOutOfStock(
  container: Pick<MedusaContainer, "resolve">
): Promise<boolean> {
  const settings = (await container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .getSection("inventory")) as unknown as Partial<InventorySettings>
  return settings.out_of_stock_listing === "hide"
}

/** The listing's filters with "in stock only" held on while the shop hides sold-out products. */
export const withStockRule = (
  filters: ListingPlan["filters"],
  hide: boolean
): ListingPlan["filters"] => (hide ? { ...filters, in_stock: true } : filters)
