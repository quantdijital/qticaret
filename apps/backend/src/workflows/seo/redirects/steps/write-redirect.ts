import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import type { RedirectPlan } from "./plan-redirect"

interface Undo {
  created: string | null
  updated: { id: string; previous: NonNullable<RedirectPlan["previous"]> } | null
  retargeted: { id: string; target: string }[]
}

/**
 * Writes the rule and points the rules that led to its source at its
 * target; the compensation puts every row back. The pattern cache is told
 * either way.
 */
export const writeRedirectStep = createStep(
  "seo-write-redirect",
  async (plan: RedirectPlan, { container }) => {
    const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    const undo: Undo = { created: null, updated: null, retargeted: [] }
    let id = plan.id
    if (id === null) {
      const created = await service.createSeoRedirects({ ...plan.fields, origin: plan.origin })
      id = created.id
      undo.created = id
    } else {
      await service.updateSeoRedirects({ id, ...plan.fields })
      undo.updated = plan.previous ? { id, previous: plan.previous } : null
    }
    if (plan.retargets.length > 0) {
      await service.updateSeoRedirects(
        plan.retargets.map((each) => ({ id: each.id, target: each.target }))
      )
      undo.retargeted = plan.retargets.map((each) => ({ id: each.id, target: each.previous }))
    }
    await service.invalidatePatterns()
    return new StepResponse({ id }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    if (undo.retargeted.length > 0) {
      await service.updateSeoRedirects(undo.retargeted)
    }
    if (undo.updated) {
      await service.updateSeoRedirects({ id: undo.updated.id, ...undo.updated.previous })
    }
    if (undo.created) {
      await service.deleteSeoRedirects(undo.created)
    }
    await service.invalidatePatterns()
  }
)
