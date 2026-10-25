import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"
import { SEO_SITEMAPS_MODULE } from "../../../modules/seo-sitemaps"
import type SeoSitemapsModuleService from "../../../modules/seo-sitemaps/service"

/**
 * Last step of a workflow that changes what a storefront path answers (a
 * page's SEO fields, a released path, a setting): every process forgets
 * its cached resolve answers, and the sitemap waits for its next refresh.
 * Answers are forgotten again on compensation, so an undone change is not
 * served either.
 */
export const forgetResolutionsStep = createStep(
  "seo-forget-resolutions",
  async (_input: undefined, { container }) => {
    await Promise.all([
      container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions(),
      container.resolve<SeoSitemapsModuleService>(SEO_SITEMAPS_MODULE).markDirty(),
    ])
    return new StepResponse(undefined, true)
  },
  async (done, { container }) => {
    if (done) {
      await container
        .resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
        .invalidateResolutions()
    }
  }
)
