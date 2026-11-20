import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
} from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError } from "@medusajs/framework/utils"
import { aiValidationError } from "../../lib/ai/errors"
import { acceptedCandidate, draftCandidates } from "../../lib/ai/draft-candidates"
import { findAiTask } from "../../lib/ai/registry/tasks"
import { CONTENT_DRAFTS_MODULE } from "../../modules/content-drafts"
import type ContentDraftsModuleService from "../../modules/content-drafts/service"
import { STAFF_ROLES_MODULE } from "../../modules/staff-roles"
import type StaffRolesModuleService from "../../modules/staff-roles/service"
import { taskFlagOpen } from "./connections"
import { AI_SUGGESTION_SOURCE } from "./steps/save-suggestion"

export interface DecideSuggestionInput {
  id: string
  decision: "accept" | "dismiss"
  /** The candidate taken, by its place among those offered (adr/0074 §4); the first when left out. */
  candidate_index?: number | undefined
  user_id: string
}

/**
 * Who may decide a suggestion of `kind`: a role the task allows, as when it
 * was asked for (adr/0071 §6), and its own flag still on: a reply drafted
 * before the shop turned `ai.reviews` off is not taken into the form after.
 */
export async function authorizeDecision(
  container: Pick<MedusaContainer, "resolve">,
  kind: string,
  userId: string
): Promise<void> {
  const task = findAiTask(kind)
  const role = await container.resolve<StaffRolesModuleService>(STAFF_ROLES_MODULE).roleOf(userId)
  if (!task || role === null || !task.roles.includes(role)) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "staff.forbidden")
  }
  if (!(await taskFlagOpen(container, task))) {
    throw new MedusaError(MedusaError.Types.FORBIDDEN, "ai.reviews_off")
  }
}

/**
 * Records a staff member's decision on a suggestion of the AI core
 * (adr/0071 §11): only one still open, and only the core's own (adr/0005's
 * old F10.13 drafts stay in the table with no route to decide them), by a
 * role the task allows. Accepting names the candidate taken, one the
 * suggestion offered (else 400 `ai.candidate_unknown`), keeps its place
 * (`accepted_index`, for the acceptance rate, adr/0074 §4) and returns
 * its text; no field is written: the panel puts it in the form, and the
 * form's own save is the change. The decision is written only while the
 * suggestion is still open (one statement): a second decision at once is
 * 400 `ai.suggestion_not_open`, never a second write. Undone by opening
 * the suggestion again (the step failed before writing: nothing to undo).
 */
export async function decideSuggestion(
  container: Pick<MedusaContainer, "resolve">,
  input: DecideSuggestionInput
) {
  const drafts = container.resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
  const [draft] = await drafts.listContentDrafts(
    { id: input.id, source: AI_SUGGESTION_SOURCE },
    { take: 1, select: ["id", "status", "text", "kind", "provider"] }
  )
  if (draft?.status !== "draft") {
    throw aiValidationError("ai.suggestion_not_open")
  }
  await authorizeDecision(container, draft.kind, input.user_id)
  const accepted = input.decision === "accept"
  // Only a candidate this suggestion offered: never a text from the client
  const taken = accepted
    ? acceptedCandidate(draftCandidates(findAiTask(draft.kind), draft.text), input.candidate_index)
    : null
  if (accepted && taken === null) {
    throw aiValidationError("ai.candidate_unknown")
  }
  // Only while still open (#247 D3): of two decisions at once, the second changes nothing
  const decided = await drafts.decideOpen(draft.id, {
    status: accepted ? "approved" : "rejected",
    decided_by: input.user_id,
    decided_at: new Date(),
    accepted_index: taken?.index ?? null,
  })
  if (!decided) {
    throw aiValidationError("ai.suggestion_not_open")
  }
  return {
    id: draft.id,
    task: draft.kind,
    service: draft.provider,
    status: accepted ? ("accepted" as const) : ("dismissed" as const),
    text: taken?.text ?? null,
    candidate_index: taken?.index ?? null,
  }
}

const decideSuggestionStep = createStep(
  "ai-decide-suggestion",
  async (input: DecideSuggestionInput, { container }) => {
    const decided = await decideSuggestion(container, input)
    return new StepResponse(decided, decided.id)
  },
  async (id, { container }) => {
    if (id) {
      await container
        .resolve<ContentDraftsModuleService>(CONTENT_DRAFTS_MODULE)
        .updateContentDrafts({
          id,
          status: "draft",
          decided_by: null,
          decided_at: null,
          accepted_index: null,
        })
    }
  }
)

export const decideSuggestionWorkflow = createWorkflow(
  "ai-decide-suggestion",
  (input: DecideSuggestionInput) => new WorkflowResponse(decideSuggestionStep(input))
)
