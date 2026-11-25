import { MedusaError } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  SEO_FILL_MAX,
  SEO_FILL_READ,
  asksOf,
  fieldsOfScope,
  quotaLeft,
} from "../../lib/ai/bulk-seo"
import type { SeoFillScope } from "../../lib/ai/bulk-seo"
import { findAiTask } from "../../lib/ai/registry/tasks"
import { ValidationError } from "../../lib/errors"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { enqueueAsyncJobWorkflow } from "../async-job/enqueue-async-job"
import { readQuota, readSeoFillTargets } from "./bulk-seo/read"
import { authorizeTaskStep } from "./steps/authorize-task"
import { selectServiceStep } from "./steps/select-service"

export interface RequestSeoFillInput {
  scope: SeoFillScope
  service?: string | null | undefined
  user_id: string
}

const TASK_OF = { seo_title: "seo_title", seo_description: "seo_description" } as const

/**
 * The pages and what they cost, before anything is queued: the role may
 * ask for every task the scope names (the first was authorised by
 * `authorizeTaskStep` with the package's flags), the advisor's findings
 * pick at most `SEO_FILL_MAX` pages, and the quota left covers one credit
 * per ask; otherwise a plain error and no job. Reads only.
 */
const checkSeoFillStep = createStep(
  "ai-check-seo-fill",
  async (input: { scope: SeoFillScope; user_id: string }, { container }) => {
    const fields = fieldsOfScope(input.scope)
    const role = await container
      .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
      .roleOf(input.user_id)
    for (const field of fields) {
      const task = findAiTask(TASK_OF[field])
      if (!task || role === null || !task.roles.includes(role)) {
        throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
      }
    }
    const { targets: found } = await readSeoFillTargets(container, fields, {
      limit: SEO_FILL_READ,
    })
    const targets = found.slice(0, SEO_FILL_MAX)
    if (targets.length === 0) {
      throw new ValidationError("ai.seo_fill_nothing")
    }
    const needed = targets.reduce(
      (total, target) =>
        total + target.tasks.reduce((sum, id) => sum + (findAiTask(id)?.credits ?? 1), 0),
      0
    )
    const left = quotaLeft(await readQuota(container))
    if (needed > left) {
      throw new ValidationError("ai.seo_fill_quota_short", {
        values: { needed: String(needed), left: String(left) },
      })
    }
    return new StepResponse({
      fields: [...fields],
      pages: targets.map(({ entity_type, entity_id }) => ({ entity_type, entity_id })),
      asks: asksOf(targets),
    })
  }
)

/**
 * The SEO fill asked for (adr/0074 §5 madde 7): authorised, a service
 * chosen as for a single search text, the pages and the quota checked,
 * then an `ai.seo_fill` job queued with the pages' ids only. Its results
 * are suggestions; nothing is written to a page until each is accepted.
 */
export const requestSeoFillWorkflow = createWorkflow(
  "ai-request-seo-fill",
  (input: RequestSeoFillInput) => {
    const firstTask = transform({ input }, ({ input }) =>
      input.scope === "description" ? "seo_description" : "seo_title"
    )
    authorizeTaskStep(
      transform({ input, firstTask }, ({ input, firstTask }) => ({
        task: firstTask,
        option: null,
        user_id: input.user_id,
      }))
    )
    const chosen = selectServiceStep(
      transform({ input, firstTask }, ({ input, firstTask }) => ({
        task: firstTask,
        user_id: input.user_id,
        service: input.service,
      }))
    )
    const checked = checkSeoFillStep(
      transform({ input }, ({ input }) => ({ scope: input.scope, user_id: input.user_id }))
    )
    const job = enqueueAsyncJobWorkflow.runAsStep({
      input: transform({ input, chosen, checked }, ({ input, chosen, checked }) => ({
        type: "ai.seo_fill",
        input: {
          fields: checked.fields,
          pages: checked.pages,
          service: chosen.service,
          // Each page is paid the way the job was chosen now, or not asked
          funding: chosen.funding,
        },
        requested_by: input.user_id,
      })),
    })
    return new WorkflowResponse(
      transform({ job, chosen, checked }, ({ job, chosen, checked }) => ({
        job_id: job.id,
        service: chosen.service,
        pages: checked.pages.length,
        asks: checked.asks,
      }))
    )
  }
)
