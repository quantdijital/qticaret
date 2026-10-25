import type { MedusaContainer } from "@medusajs/framework/types"
import { RULES_VERSION, assess } from "../../../lib/seo/advisor"
import type { Assessment, PageKind } from "../../../lib/seo/advisor"
import { SEO_ADVISOR_MODULE } from "../../../modules/seo-advisor"
import type SeoAdvisorModuleService from "../../../modules/seo-advisor/service"
import { advisorFacts } from "./facts"

/**
 * Assesses one page now (docs/14) and keeps the result for lists and the
 * shop's score; a page that is gone loses its assessment.
 */
export async function assessPage(
  container: MedusaContainer,
  kind: PageKind,
  id: string
): Promise<Assessment | null> {
  const service = container.resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
  const facts = await advisorFacts(container, kind, id)
  if (!facts) {
    await service.deleteSeoAssessments({ entity_type: kind, entity_id: id })
    return null
  }
  const result = assess(facts)
  await service.saveAssessment({
    entity_type: kind,
    entity_id: id,
    score: result.score,
    grade: result.grade,
    issues: result.issues as unknown as Record<string, unknown>[],
    critical: result.issues.filter((issue) => issue.severity === "critical").length,
    rules_version: RULES_VERSION,
  })
  return result
}
