import type { MedusaContainer } from "@medusajs/framework/types"
import { seoFillKinds, seoFillTargets } from "../../../lib/ai/bulk-seo"
import type { SeoFillField, SeoFillTarget } from "../../../lib/ai/bulk-seo"
import { SEO_DESCRIPTION_TASK, SEO_TITLE_TASK } from "../../../lib/ai/registry/tasks"
import { draftQuotaOf } from "../../../lib/plan-limits"
import { AI_MODULE } from "../../../modules/ai"
import type AiModuleService from "../../../modules/ai/service"
import { CONTENT_DRAFTS_MODULE } from "../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../modules/content-drafts/service"
import { SEO_ADVISOR_MODULE } from "../../../modules/seo-advisor"
import { ASSESSED_KINDS } from "../../../modules/seo-advisor/models/seo-assessment"
import type SeoAdvisorModuleService from "../../../modules/seo-advisor/service"
import { dailyLimitsInForce } from "../steps/claim-quota"
import { AI_SUGGESTION_SOURCE } from "../steps/save-suggestion"

/**
 * What the SEO fill reads (adr/0074 §5 madde 7): the advisor's stored
 * assessments, the suggestions already waiting for a decision and what the
 * quota still allows. Reads only.
 */

type Container = Pick<MedusaContainer, "resolve">

/** The two tasks the fill asks for. */
export const SEO_FILL_TASK_IDS: readonly string[] = [SEO_TITLE_TASK.id, SEO_DESCRIPTION_TASK.id]

/** Above any package's monthly operations: only the package's own limit counts. */
const NO_MONTHLY_CEILING = 2_147_483_647

/** `type:id:task` of the search text suggestions waiting for a decision (of these pages, when named). */
export async function waitingSeoKeys(
  container: Container,
  ids?: readonly string[]
): Promise<Set<string>> {
  const open = await container
    .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    .listContentDrafts(
      {
        kind: [...SEO_FILL_TASK_IDS],
        source: AI_SUGGESTION_SOURCE,
        status: "draft",
        ...(ids ? { entity_id: [...ids] } : {}),
      },
      { select: ["entity_type", "entity_id", "kind"] }
    )
  return new Set(open.map((draft) => `${draft.entity_type}:${draft.entity_id}:${draft.kind}`))
}

/**
 * The pages worth asking for, the lowest score first, with the tasks their
 * findings ask for and no suggestion already waiting. With `ids`, only
 * those pages (the job checking again what it was queued with).
 */
export async function readSeoFillTargets(
  container: Container,
  fields: readonly SeoFillField[],
  ids?: readonly string[]
): Promise<SeoFillTarget[]> {
  const kinds = seoFillKinds(ASSESSED_KINDS)
  if (kinds.length === 0) {
    return []
  }
  // A shop's pages fit: only the findings are read, no page's own text
  const rows = await container
    .resolve<SeoAdvisorModuleService>(SEO_ADVISOR_MODULE)
    .listSeoAssessments(
      { entity_type: kinds, ...(ids ? { entity_id: [...ids] } : {}) },
      {
        select: ["entity_type", "entity_id", "issues"],
        order: { score: "ASC", entity_id: "ASC" },
      }
    )
  return seoFillTargets(rows, fields, await waitingSeoKeys(container, ids))
}

/** The text asks the quota still allows now: the month's operations and today's text ceiling, as the usage page shows them. */
export async function readQuota(container: Container): Promise<{
  monthly: { used: number; limit: number | null }
  daily: { used: number; limit: number }
}> {
  const now = new Date()
  const group = "text" as const
  const [used, budget, today] = await Promise.all([
    container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE).usedThisMonth(now),
    draftQuotaOf(container, NO_MONTHLY_CEILING),
    container.resolve<AiModuleService>(AI_MODULE).usedToday(group, now),
  ])
  return {
    monthly: { used, limit: budget.plan },
    daily: { used: today, limit: dailyLimitsInForce()[group] },
  }
}
