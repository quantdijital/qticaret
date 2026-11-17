import type { MedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { usagePeriodOf } from "@qticaret/types/control-plane"
import { AI_LIMIT_GROUPS } from "../../../../lib/ai/limits"
import { draftQuotaOf } from "../../../../lib/plan-limits"
import { AI_MODULE } from "../../../../modules/ai"
import type AiModuleService from "../../../../modules/ai/service"
import { CONTENT_DRAFTS_MODULE } from "../../../../modules/content-drafts"
import type ContentDraftsModuleService from "../../../../modules/content-drafts/service"
import { dailyLimitsInForce } from "../../../../workflows/ai/steps/claim-quota"
import type { AdminGetAiUsageType } from "../validators"

/** Above any package's monthly operations: only the package's own limit is reported. */
const NO_MONTHLY_CEILING = 2_147_483_647

/**
 * GET /admin/ai/usage?month= (adr/0071 §11): a month's attempts by
 * service and task with the estimated cost, the month's AI operations
 * against the package's limit (`limit` null: none) and today's against
 * the daily ceilings. Owner and admin only (`permission-rules.ts`).
 */
export async function GET(
  req: MedusaRequest<unknown, AdminGetAiUsageType>,
  res: MedusaResponse
): Promise<void> {
  const query = req.validatedQuery as AdminGetAiUsageType
  const month = query.month ?? usagePeriodOf(new Date())
  const ai = req.scope.resolve<AiModuleService>(AI_MODULE)
  const drafts = req.scope.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
  const limits = dailyLimitsInForce()
  const [summary, used, budget, today] = await Promise.all([
    ai.usageSummary(month),
    drafts.usedIn(month),
    draftQuotaOf(req.scope, NO_MONTHLY_CEILING),
    Promise.all(AI_LIMIT_GROUPS.map((group) => ai.usedToday(group))),
  ])
  res.json({
    ...summary,
    monthly: { used, limit: budget.plan },
    daily: Object.fromEntries(
      AI_LIMIT_GROUPS.map((group, index) => [
        group,
        { used: today[index] ?? 0, limit: limits[group] },
      ])
    ),
  })
}
