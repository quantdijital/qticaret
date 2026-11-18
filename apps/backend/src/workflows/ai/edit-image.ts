import {
  WorkflowResponse,
  createWorkflow,
  transform,
  when,
} from "@medusajs/framework/workflows-sdk"
import type { AiFunding, ImageBackground } from "../../lib/ai/registry/services"
import { registerMediaStep } from "../media/steps/register-media"
import { claimQuotaStep, releaseUntakenStep } from "./steps/claim-quota"
import { editImageStep } from "./steps/edit-image"
import { recordUsageStep } from "./steps/record-usage"
import { saveSuggestionStep } from "./steps/save-suggestion"

export interface EditImageWorkflowInput {
  task: string
  service: string
  funding: AiFunding
  background: ImageBackground
  media_id: string
  user_id: string
  /** The staff member picked the service among several: remember it (adr/0071 §4). */
  remember: boolean
}

/**
 * One picture of a background job (Aşama 4; adr/0071 §5, §8): its own
 * claim on the day's and the month's quota, the edit, the claim given back
 * when the service never took the job, then the result kept as a new
 * media record beside the original (`ai_source: edited`,
 * `derived_from_id`; counted in the package's storage, out of the library
 * and on no product, so the nightly sweep takes it if nobody uses it), a
 * suggestion waiting for a decision (its text is the new record's id) and
 * the attempt recorded. The original's bytes and records are not written.
 */
export const editImageWorkflow = createWorkflow(
  "ai-edit-image",
  (input: EditImageWorkflowInput) => {
    const claimed = claimQuotaStep({ capability: "image_edit" })
    const outcome = editImageStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        service: input.service,
        background: input.background,
        media_id: input.media_id,
      }))
    )
    releaseUntakenStep(
      transform({ claimed, outcome }, ({ claimed, outcome }) => ({ claimed, outcome }))
    )
    const assets = when(
      "ai-edit-image-stored",
      { outcome },
      ({ outcome }) => !!outcome.file_id
    ).then(() =>
      registerMediaStep(
        transform({ input, outcome }, ({ input, outcome }) => ({
          file_ids: [outcome.file_id ?? ""],
          library: false,
          uploaded_by: input.user_id,
          origin: { ai_source: "edited" as const, derived_from_id: input.media_id },
        }))
      )
    )
    const kept = transform({ outcome, assets }, ({ outcome, assets }) => ({
      ...outcome,
      text: assets?.[0]?.id ?? null,
    }))
    const suggestion = saveSuggestionStep(
      transform({ input, kept }, ({ input, kept }) => ({
        task: input.task,
        service: input.service,
        entity_type: "media",
        entity_id: input.media_id,
        // No prompt leaves: the task's fixed instruction and the picture
        system: `${input.task}:${input.background}`,
        data: "",
        outcome: kept,
        user_id: input.user_id,
      }))
    )
    recordUsageStep(
      transform({ input, kept, suggestion }, ({ input, kept, suggestion }) => ({
        task: input.task,
        capability: "image_edit" as const,
        service: input.service,
        funding: input.funding,
        outcome: kept,
        entity_type: "media",
        entity_id: input.media_id,
        suggestion_id: suggestion.id,
        user_id: input.user_id,
        remember: input.remember,
      }))
    )
    return new WorkflowResponse(
      transform({ kept, suggestion }, ({ kept, suggestion }) => ({
        status: kept.status,
        error_key: kept.error_key,
        error_code: kept.error_code,
        media_id: kept.text,
        suggestion_id: suggestion.id,
      }))
    )
  }
)
