import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { imageTargetOf } from "../../lib/ai/image-connector-of"
import { sceneTargetOf } from "../../lib/ai/registry/services"
import type { AiFunding, AiUnitPrice, ImageBackground } from "../../lib/ai/registry/services"
import { claimQuotaStep, releaseUntakenStep } from "./steps/claim-quota"
import { editImageStep } from "./steps/edit-image"
import { keepEditedImageStep } from "./steps/keep-edited-image"
import { recordUsageStep } from "./steps/record-usage"
import { saveSuggestionStep } from "./steps/save-suggestion"

/** The scene endpoint's own price, where the registry gives one. */
function sceneUnitPriceOf(serviceId: string): AiUnitPrice | null {
  const scene = sceneTargetOf(imageTargetOf(serviceId)?.target)
  return scene && "unitPrice" in scene ? (scene.unitPrice ?? null) : null
}

export interface EditImageWorkflowInput {
  task: string
  service: string
  funding: AiFunding
  /** `image_background`. */
  background?: ImageBackground | null | undefined
  /** `image_scene`: the shop's scene by its code (checked against its packs in the edit step). */
  scene?: string | null | undefined
  media_id: string
  user_id: string
  /** The staff member picked the service among several: remember it (adr/0071 §4). */
  remember: boolean
}

/**
 * One picture of a background or scene job (Aşama 4, 7; adr/0071 §5, §8): its own
 * claim on the day's and the month's quota, the edit, the claim given back
 * when the service never took the job, then the result kept as a new
 * media record beside the original (`ai_source: edited`,
 * `derived_from_id`; counted in the package's storage, out of the library
 * and on no product, so the nightly sweep takes it if nobody uses it), a
 * suggestion waiting for a decision (its text is the new record's id) and
 * the attempt recorded, priced by the image where the service is. A
 * result that cannot be kept is removed and the attempt still recorded
 * (`keepEditedImageStep`); a later step failing removes the record and
 * the file. The original's bytes and records are not written.
 */
export const editImageWorkflow = createWorkflow(
  "ai-edit-image",
  (input: EditImageWorkflowInput) => {
    const claimed = claimQuotaStep({ capability: "image_edit" })
    const outcome = editImageStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        service: input.service,
        background: input.background ?? null,
        scene: input.scene ?? null,
        media_id: input.media_id,
      }))
    )
    releaseUntakenStep(
      transform({ claimed, outcome }, ({ claimed, outcome }) => ({ claimed, outcome }))
    )
    const kept = keepEditedImageStep(
      transform({ input, outcome }, ({ input, outcome }) => ({
        outcome,
        media_id: input.media_id,
        user_id: input.user_id,
      }))
    )
    const suggestion = saveSuggestionStep(
      transform({ input, kept }, ({ input, kept }) => ({
        task: input.task,
        service: input.service,
        entity_type: "media",
        entity_id: input.media_id,
        // No prompt leaves: the task's fixed instruction and the picture
        system: `${input.task}:${input.background ?? input.scene ?? ""}`,
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
        // A scene endpoint priced on its own (Photoroom's Image Editing API)
        unit_price: input.scene ? sceneUnitPriceOf(input.service) : null,
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
