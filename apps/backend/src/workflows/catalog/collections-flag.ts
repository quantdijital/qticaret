import type { MedusaContainer } from "@medusajs/framework/types"
import { PLATFORM_SETTINGS_MODULE } from "../../modules/platform-settings"
import { CATALOG_COLLECTIONS } from "../../modules/platform-settings/features"
import type PlatformSettingsModuleService from "../../modules/platform-settings/service"
import { SEO_REDIRECTS_MODULE } from "../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../modules/seo-redirects/service"
import { SEO_SITEMAPS_MODULE } from "../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../modules/seo-sitemaps/service"

type Container = Pick<MedusaContainer, "resolve">

/**
 * Whether the shop has collections on (`catalog.collections`, on by
 * default). Off, every collection reads as hidden wherever the storefront
 * asks (its page, the sitemap, menus, IndexNow); the records stay.
 */
export const collectionsOn = (container: Container): Promise<boolean> =>
  container
    .resolve<PlatformSettingsModuleService>(PLATFORM_SETTINGS_MODULE)
    .isFeatureEnabled(CATALOG_COLLECTIONS)

/**
 * The flag changed what collection paths answer: every process forgets its
 * cached resolve answers and the sitemap is built again on its next refresh.
 */
export async function forgetCollectionPages(container: Container): Promise<void> {
  await Promise.all([
    container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions(),
    container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).markDirty(),
  ])
}
