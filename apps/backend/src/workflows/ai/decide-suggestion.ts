import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import { MedusaError } from "@medusajs/framework/utils"
import { aiValidationError } from "../../lib/ai/errors"
import { findAiTask } from "../../lib/ai/registry/tasks"
import { CONTENT_DRAFTS_MODULE } from "../../modules/content-drafts"
import type ContentDraftsModuleService from "../../modules/content-drafts/service"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { AI_SUGGESTION_SOURCE } from "./steps/save-suggestion"

export interface DecideSuggestionInput {
  id: string
  decision: "accept" | "dismiss"
  user_id: string
}

/**
 * Records a staff member's decision on a suggestion of the AI core
 * (adr/0071 §11): only one still open, and only the core's own (adr/0005's
 * old F10.13 drafts stay in the table with no route to decide them), by a
 * role the task allows. Accepting returns the text and
 * writes no field: the panel puts it in the form, and the form's own save
 * is the change. Undone by opening the suggestion again.
 */
const decideSuggestionStep = createStep(
  "ai-decide-suggestion",
  async (input: DecideSuggestionInput, { container }) => {
    const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
    const [draft] = await drafts.listContentDrafts(
      { id: input.id, source: AI_SUGGESTION_SOURCE },
      { take: 1, select: ["id", "status", "text", "kind", "provider"] }
    )
    if (draft?.status !== "draft") {
      throw aiValidationError("ai.suggestion_not_open")
    }
    // The task's own roles, as when it was asked for (adr/0071 §6)
    const task = findAiTask(draft.kind)
    const role = await container
      .resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE)
      .roleOf(input.user_id)
    if (!task || role === null || !task.roles.includes(role)) {
      throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
    }
    const accepted = input.decision === "accept"
    await drafts.updateContentDrafts({
      id: draft.id,
      status: accepted ? "approved" : "rejected",
      decided_by: input.user_id,
      decided_at: new Date(),
    })
    return new StepResponse(
      {
        id: draft.id,
        task: draft.kind,
        service: draft.provider,
        status: accepted ? ("accepted" as const) : ("dismissed" as const),
        text: accepted ? draft.text : null,
      },
      draft.id
    )
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
        .updateContentDrafts({ id, status: "draft", decided_by: null, decided_at: null })
    }
  }
)

export const decideSuggestionWorkflow = createWorkflow(
  "ai-decide-suggestion",
  (input: DecideSuggestionInput) => new WorkflowResponse(decideSuggestionStep(input))
)
