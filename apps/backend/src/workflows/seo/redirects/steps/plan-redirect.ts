import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { SEO_REDIRECTS_MODULE } from "../../../../modules/seo-redirects"
import type { REDIRECT_ORIGINS } from "../../../../modules/seo-redirects/models/seo-redirect"
import type SeoRedirectsModuleService from "../../../../modules/seo-redirects/service"
import { toRedirectRule } from "../../../../modules/seo-redirects/service"
import { checkAgainstShop, checkRuleSet, fieldsOfRule, retargets, storedFields } from "../plan"
import type { RedirectFields, RedirectInput, Retarget } from "../plan"

export type RedirectOrigin = (typeof REDIRECT_ORIGINS)[number]

export interface UpsertRedirectInput {
  /** The rule to change; none makes a new one. */
  id?: string | undefined
  rule: RedirectInput
  origin?: RedirectOrigin | undefined
}

export interface RedirectPlan {
  id: string | null
  fields: RedirectFields
  origin: RedirectOrigin
  /** The rule as it was, for the compensation. */
  previous: RedirectFields | null
  retargets: Retarget[]
}

/** Checks a rule against the rule set and the shop, and finds the chains it closes. */
export const planRedirectStep = createStep(
  "seo-plan-redirect",
  async (input: UpsertRedirectInput, { container }) => {
    const redirects = container.resolve<SeoRedirectsModuleService>(SEO_REDIRECTS_MODULE)
    const id = input.id ?? null
    let previous: RedirectFields | null = null
    if (id !== null) {
      const [current] = await redirects.listSeoRedirects({ id }, { take: 1 })
      if (!current) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "seo.redirect_unknown")
      }
      previous = fieldsOfRule(toRedirectRule(current))
    }
    const stored = storedFields(input.rule)
    await checkRuleSet(container, stored, id)
    const fields = await checkAgainstShop(container, stored, id)
    const plan: RedirectPlan = {
      id,
      fields,
      origin: input.origin ?? "manual",
      previous,
      retargets: await retargets(container, fields, id),
    }
    return new StepResponse(plan)
  }
)
