import type { SubscriberArgs, SubscriberConfig } from "@medusajs/framework"
import { SEO_REDIRECTS_MODULE } from "../modules/seo-redirects"
import type SeoRedirectsModuleService from "../modules/seo-redirects/service"
import { SEO_SITEMAPS_MODULE } from "../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../modules/seo-sitemaps/service"

/**
 * A catalog change can move what a storefront path answers (a new handle,
 * an unpublished product, a price in the description): cached resolve
 * answers are forgotten in every process, and the sitemap waits for its
 * next refresh. Medusa has no store event, so a
 * new shop name (in titles) shows within the cache's 30 seconds, as any
 * missed event would.
 */
export default async function seoResolutionsChanged({ container }: SubscriberArgs) {
  await Promise.all([
    container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions(),
    container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).markDirty(),
  ])
}

export const config: SubscriberConfig = {
  event: [
    "product.created",
    "product.updated",
    "product.deleted",
    "product-variant.created",
    "product-variant.updated",
    "product-variant.deleted",
    "product-category.created",
    "product-category.updated",
    "product-category.deleted",
    "product-collection.created",
    "product-collection.updated",
    "product-collection.deleted",
  ],
}
