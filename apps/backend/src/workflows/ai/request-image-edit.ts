import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import type { MedusaContainer } from "@medusajs/framework/types"
import { aiValidationError } from "../../lib/ai/errors"
import { imageTargetOf } from "../../lib/ai/image-connector-of"
import { PLATFORM_SERVICE_ID, platformBackingOf } from "../../lib/ai/registry/platform-service"
import { aiCreditsStatus } from "../../lib/control-plane/ai-credits"
import { findAiTask } from "../../lib/ai/registry/tasks"
import type { AiTask } from "../../lib/ai/registry/tasks"
import { IMAGE_BACKGROUNDS } from "../../lib/ai/registry/services"
import type { ImageBackground } from "../../lib/ai/registry/services"
import { CUSTOM_SCENE_CODE } from "../../lib/ai/scene-text"
import { customScene, shopSceneOf } from "../../lib/ai/scenes"
import { SVG_MIME } from "../../lib/media/svg"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { enqueueAsyncJobWorkflow } from "../async-job/enqueue-async-job"
import { authorizeTaskStep } from "./steps/authorize-task"
import { selectServiceStep } from "./steps/select-service"

export interface RequestImageEditInput {
  task: string
  /**
   * `image_background`: the background; `image_scene`: the shop's scene
   * code or a saved scene's id. Left out for a scene typed once (`custom`).
   */
  option?: string | null | undefined
  /** `image_scene`: a description typed for this once; client data, held here. */
  custom?: string | null | undefined
  media_ids: string[]
  service?: string | null | undefined
  user_id: string
}

type JobOption = { background: ImageBackground } | { scene: string } | { custom: string }

/**
 * The service whose image endpoint edits for this choice: the chosen one,
 * or on the platform's credits the one the status routes image editing to
 * (adr/0085 §3; the edit step resolves it the same way, `transportFor`).
 */
async function imageServiceOf(service: string): Promise<string> {
  if (service !== PLATFORM_SERVICE_ID) {
    return service
  }
  const status = await aiCreditsStatus()
  return status.available
    ? (platformBackingOf(status.services, "image_edit")?.id ?? service)
    : service
}

/**
 * What the job is asked to do: a background the endpoint makes, one of
 * the shop's scenes (its own saved ones, then its packs'), or a scene
 * typed for this once, cleaned (`cleanSceneText`) before it is queued.
 */
async function optionOf(
  container: Pick<MedusaContainer, "resolve">,
  task: AiTask,
  service: string,
  input: { option?: string | null | undefined; custom?: string | null | undefined }
): Promise<JobOption> {
  const target = imageTargetOf(await imageServiceOf(service))?.target
  if (task.optionSource === "scenes") {
    if (!target?.scene) {
      throw aiValidationError("ai.service_unavailable")
    }
    if (input.custom !== undefined && input.custom !== null) {
      const typed = customScene(input.custom)
      if (typed === null) {
        throw aiValidationError("ai.scene_text_invalid")
      }
      return { custom: typed.prompt }
    }
    // The allow-list: this shop's own scenes and its packs', nothing else
    if (!input.option || (await shopSceneOf(container, input.option)) === null) {
      throw aiValidationError("ai.unknown_task")
    }
    return { scene: input.option }
  }
  const option = input.option ?? ""
  if (input.custom !== undefined && input.custom !== null) {
    throw aiValidationError("ai.unknown_task")
  }
  const background = IMAGE_BACKGROUNDS.find((each) => each === option)
  if (!background) {
    throw aiValidationError("ai.unknown_task")
  }
  if (!target?.backgrounds.includes(background)) {
    throw aiValidationError("ai.service_unavailable")
  }
  return { background }
}

/**
 * The pictures can be edited by the chosen service (Aşama 4, 7): an image
 * task, a background the service's endpoint makes, a scene of the
 * shop's (its own or its packs') or one typed once on a service with a scene endpoint, at most the task's
 * batch, and each id a stored raster picture of the library (an SVG or a
 * record with no master has no bytes to send). Reads only.
 */
const checkImagesStep = createStep(
  "ai-check-images",
  async (
    input: {
      task: string
      service: string
      option?: string | null | undefined
      custom?: string | null | undefined
      media_ids: string[]
    },
    { container }
  ) => {
    const task = findAiTask(input.task)
    if (task?.capability !== "image_edit" || task.mode !== "job") {
      throw aiValidationError("ai.unknown_task")
    }
    const ids = [...new Set(input.media_ids)]
    if (ids.length === 0 || ids.length > (task.maxBatch ?? 1)) {
      throw aiValidationError("ai.unknown_entity")
    }
    const option = await optionOf(container, task, input.service, input)
    const found = await container
      .resolve<MediaModuleService>(MEDIA_MODULE)
      .listMediaAssets({ id: ids }, { select: ["id", "file_id", "mime_type"], take: ids.length })
    if (found.length !== ids.length || found.some((asset) => !asset.file_id)) {
      throw aiValidationError("ai.unknown_entity")
    }
    if (found.some((asset) => !asset.mime_type || asset.mime_type === SVG_MIME)) {
      throw aiValidationError("ai.input_unsupported")
    }
    return new StepResponse({ ids, option })
  }
)

/**
 * A background or scene job asked for (adr/0071 §6, §8, §11): the task and its
 * option authorised for the asker's role, a service chosen as for any
 * task, the pictures checked, then an `ai.image_edit` job queued with
 * identifiers only (a scene typed once: its cleaned words). Its results are suggestions; nothing is written to a
 * product or to the pictures asked about.
 */
export const requestImageEditWorkflow = createWorkflow(
  "ai-request-image-edit",
  (input: RequestImageEditInput) => {
    authorizeTaskStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        option: input.custom ? CUSTOM_SCENE_CODE : (input.option ?? null),
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
    const checked = checkImagesStep(
      transform({ input, chosen }, ({ input, chosen }) => ({
        task: input.task,
        service: chosen.service,
        option: input.option ?? null,
        custom: input.custom ?? null,
        media_ids: input.media_ids,
      }))
    )
    const job = enqueueAsyncJobWorkflow.runAsStep({
      input: transform({ input, chosen, checked }, ({ input, chosen, checked }) => ({
        type: "ai.image_edit",
        input: {
          task: input.task,
          service: chosen.service,
          funding: chosen.funding,
          ...checked.option,
          media_ids: checked.ids,
          remember: chosen.remember,
        },
        requested_by: input.user_id,
      })),
    })
    return new WorkflowResponse(
      transform({ job, chosen }, ({ job, chosen }) => ({
        job_id: job.id,
        service: chosen.service,
        alternatives: chosen.alternatives,
      }))
    )
  }
)
