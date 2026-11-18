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
import { findAiTask } from "../../lib/ai/registry/tasks"
import type { AiTask } from "../../lib/ai/registry/tasks"
import { IMAGE_BACKGROUNDS } from "../../lib/ai/registry/services"
import type { ImageBackground } from "../../lib/ai/registry/services"
import { shopSceneOf } from "../../lib/ai/scenes"
import { SVG_MIME } from "../../lib/media/svg"
import { MEDIA_MODULE } from "../../modules/media"
import type MediaModuleService from "../../modules/media/service"
import { enqueueAsyncJobWorkflow } from "../async-job/enqueue-async-job"
import { authorizeTaskStep } from "./steps/authorize-task"
import { selectServiceStep } from "./steps/select-service"

export interface RequestImageEditInput {
  task: string
  /** `image_background`: the background; `image_scene`: the shop's scene code. */
  option: string
  media_ids: string[]
  service?: string | null | undefined
  user_id: string
}

/** What the job is asked to do: a background the endpoint makes, or one of the shop's scenes. */
async function optionOf(
  container: Pick<MedusaContainer, "resolve">,
  task: AiTask,
  service: string,
  option: string
): Promise<{ background: ImageBackground } | { scene: string }> {
  const target = imageTargetOf(service)?.target
  if (task.optionSource === "scenes") {
    if (!target?.scene) {
      throw aiValidationError("ai.service_unavailable")
    }
    // The allow-list: the scenes of the shop's packs, nothing else
    if ((await shopSceneOf(container, option)) === null) {
      throw aiValidationError("ai.unknown_task")
    }
    return { scene: option }
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
 * task, a background the service's endpoint makes or a scene of the
 * shop's packs on a service with a scene endpoint, at most the task's
 * batch, and each id a stored raster picture of the library (an SVG or a
 * record with no master has no bytes to send). Reads only.
 */
const checkImagesStep = createStep(
  "ai-check-images",
  async (
    input: { task: string; service: string; option: string; media_ids: string[] },
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
    const option = await optionOf(container, task, input.service, input.option)
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
 * identifiers only. Its results are suggestions; nothing is written to a
 * product or to the pictures asked about.
 */
export const requestImageEditWorkflow = createWorkflow(
  "ai-request-image-edit",
  (input: RequestImageEditInput) => {
    authorizeTaskStep(
      transform({ input }, ({ input }) => ({
        task: input.task,
        option: input.option,
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
        option: input.option,
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
