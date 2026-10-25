import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEO_REDIRECTS_MODULE } from "../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../modules/seo-redirects/service"

/**
 * Last step of a workflow that changes what a storefront path answers (a
 * page's SEO fields, a released path, a setting): every process forgets
 * its cached resolve answers. Again on compensation, so an undone change
 * is not served either.
 */
export const forgetResolutionsStep = createStep(
  "seo-forget-resolutions",
  async (_input: undefined, { container }) => {
    await container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE).invalidateResolutions()
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
