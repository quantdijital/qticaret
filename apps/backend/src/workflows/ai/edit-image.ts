import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { imageTargetOf } from "../../lib/ai/image-connector-of"
import { sceneTargetOf } from "../../lib/ai/registry/services"
import { CUSTOM_SCENE_CODE } from "../../lib/ai/scene-text"
import type { AiFunding, AiUnitPrice, ImageBackground } from "../../lib/ai/registry/services"
import { authorizeTaskStep } from "./steps/authorize-task"
import { claimQuotaStep, releaseUntakenStep } from "./steps/claim-quota"
import { editImageStep } from "./steps/edit-image"
import { keepEditedImageStep } from "./steps/keep-edited-image"
import { linkUsageSuggestionStep, recordUsageStep } from "./steps/record-usage"
import { saveSuggestionStep } from "./steps/save-suggestion"
import { keepQueuedServiceStep, selectServiceStep } from "./steps/select-service"

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
  /** `image_scene`: the shop's scene by its code (checked against its scenes in the edit step). */
  scene?: string | null | undefined
  /** `image_scene`: a scene typed once, cleaned when queued and again in the edit step. */
  custom?: string | null | undefined
  media_id: string
  user_id: string
  /** The staff member picked the service among several: remember it (adr/0071 §4). */
  remember: boolean
}

/**
 * One picture of a background or scene job (Aşama 4, 7; adr/0071 §5, §8).
 * First, as for a single ask, the asker's role, the package's flags and
 * the service are checked again for this picture: the job runs after it
 * was queued, and a staff member whose role was lowered, an
 * `ai.own_keys` closed or the queued service gone stops it here, before
 * any quota or call (`keepQueuedServiceStep`). Then its own claim on the
 * day's and the month's quota, the edit, the claim given back when the
 * service never took the job, the result kept as a new media record
 * beside the original (`ai_source: edited`, `derived_from_id`; counted in
 * the package's storage, out of the library and on no product, so the
 * nightly sweep takes it if nobody uses it), and the attempt recorded,
 * priced by the image where the service is. The usage row is written
 * before the suggestion and has no undo: the service was paid, so a
 * failing suggestion step rolls back the record and the file but never
 * the row; the suggestion's id is linked to the row afterwards. A result
 * that cannot be kept is removed and the attempt still recorded
 * (`keepEditedImageStep`). The original's bytes and records are not written.
 */
export const editImageWorkflow = createWorkflow(
  "ai-edit-image",
  (input: EditImageWorkflowInput) => {
    authorizeTaskStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        option: input.background ?? input.scene ?? (input.custom ? CUSTOM_SCENE_CODE : null),
        user_id: input.user_id,
      }))
    )
    const chosen = selectServiceStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        user_id: input.user_id,
        service: input.service,
      }))
    )
    keepQueuedServiceStep(
      transform({ input, chosen }, ({ input, chosen }) => ({
        queued: { service: input.service, funding: input.funding },
        chosen: { service: chosen.service, funding: chosen.funding },
      }))
    )
    const claimed = claimQuotaStep({ capability: "image_edit" })
    const outcome = editImageStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        service: input.service,
        background: input.background ?? null,
        scene: input.scene ?? null,
        custom: input.custom ?? null,
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
    // Straight after the paid call and the keeping: a later failure cannot undo it
    const usage = recordUsageStep(
      transform({ input, kept }, ({ input, kept }) => ({
        task: input.task,
        capability: "image_edit" as const,
        service: input.service,
        funding: input.funding,
        outcome: kept,
        entity_type: "media",
        entity_id: input.media_id,
        suggestion_id: null,
        user_id: input.user_id,
        remember: input.remember,
        // A scene endpoint priced on its own (Photoroom's Image Editing API)
        unit_price: input.scene || input.custom ? sceneUnitPriceOf(input.service) : null,
      }))
    )
    const suggestion = saveSuggestionStep(
      transform({ input, kept }, ({ input, kept }) => ({
        task: input.task,
        service: input.service,
        entity_type: "media",
        entity_id: input.media_id,
        // No prompt leaves (a typed scene is recorded as `custom`, never its words)
        system: `${input.task}:${input.background ?? input.scene ?? (input.custom ? CUSTOM_SCENE_CODE : "")}`,
        data: "",
        outcome: kept,
        user_id: input.user_id,
      }))
    )
    linkUsageSuggestionStep(
      transform({ usage, suggestion }, ({ usage, suggestion }) => ({
        usage_id: usage.usage_id,
        suggestion_id: suggestion.id,
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
