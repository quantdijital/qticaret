import type { AuthenticatedMedusaRequest, MedusaResponse } from "@medusajs/framework/http"
import { MedusaError } from "@medusajs/framework/utils"
import { SEO_FILL_FIELDS, SEO_FILL_MAX } from "../../../../lib/ai/bulk-seo"
import { SEO_TITLE_TASK } from "../../../../lib/ai/registry/tasks"
import { STAFF_ROLES_MODULE } from "../../../../modules/staff-roles"
import type StaffRolesModuleService from "../../../../modules/staff-roles/service"
import { readSeoFillTargets } from "../../../../workflows/ai/bulk-seo/read"
import { requestSeoFillWorkflow } from "../../../../workflows/ai/request-seo-fill"
import type { AdminPostSeoFillType } from "./validators"

/**
 * GET /admin/ai/seo-fill (adr/0074 §5 madde 7): how many pages have a
 * finding an AI search text closes and no suggestion waiting, in all and
 * by field, and how many one job takes. The button's count; read only.
 * The task's roles only (owner, admin).
 */
export async function GET(req: AuthenticatedMedusaRequest, res: MedusaResponse): Promise<void> {
  const role = await req.scope
    .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
    .roleOf(req.auth_context.actor_id)
  if (role === null || !SEO_TITLE_TASK.roles.includes(role)) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
  }
  const targets = await readSeoFillTargets(req.scope, SEO_FILL_FIELDS)
  res.json({
    pages: targets.length,
    title: targets.filter((target) => target.tasks.includes("seo_title")).length,
    description: targets.filter((target) => target.tasks.includes("seo_description")).length,
    max: SEO_FILL_MAX,
  })
}

/**
 * POST /admin/ai/seo-fill: queues the bulk job for the first
 * `SEO_FILL_MAX` pages (202 with its id); 400 `ai.seo_fill_quota_short`
 * when the quota left does not cover one credit per ask, 400
 * `ai.seo_fill_nothing` when no page needs it. Nothing is written to a
 * page: each suggestion waits for a decision.
 */
export async function POST(
  req: AuthenticatedMedusaRequest<AdminPostSeoFillType>,
  res: MedusaResponse
): Promise<void> {
  const { result } = await requestSeoFillWorkflow(req.scope).run({
    input: {
      scope: req.validatedBody.scope,
      service: req.validatedBody.service,
      user_id: req.auth_context.actor_id,
    },
  })
  res.status(202).json(result)
}
