import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"

/**
 * Removes rules (soft, so the compensation can bring them back). Their
 * sources answer what they would without them: an old product path still
 * reaches the product through the URL registry.
 */
export const deleteRedirectsStep = createStep(
  "seo-delete-redirects",
  async (ids: string[], { container }) => {
    const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    const found = await service.listSeoRedirects({ id: ids }, { select: ["id"] })
    if (found.length === 0) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.redirect_unknown")
    }
    const removed = found.map(({ id }) => id)
    await service.softDeleteSeoRedirects(removed)
    await service.invalidatePatterns()
    return new StepResponse({ ids: removed }, removed)
  },
  async (removed, { container }) => {
    if (!removed?.length) {
      return
    }
    const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    await service.restoreSeoRedirects(removed)
    await service.invalidatePatterns()
  }
)
