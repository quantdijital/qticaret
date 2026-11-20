import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { withAiBreaker } from "../../../lib/ai/breaker"
import { isPlanLimitError } from "../../../lib/errors"
import { aiProviderError } from "../../../lib/ai/errors"
import { imageConnectorFor, imageTargetOf } from "../../../lib/ai/image-connector-of"
import { readVisionSource } from "../../../lib/ai/image-input"
import { failureOf } from "../../../lib/ai/outcome"
import type { ImageEditConnector } from "../../../lib/ai/connectors/image-types"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import type { AiTask } from "../../../lib/ai/registry/tasks"
import { sceneTargetOf } from "../../../lib/ai/registry/services"
import type { ImageBackground } from "../../../lib/ai/registry/services"
import { answeredUsageOf, runImageEdit, runImageScene } from "../../../lib/ai/run-image"
import type { ImageEditDone } from "../../../lib/ai/run-image"
import { customScene, settingOf, shopSceneOf } from "../../../lib/ai/scenes"
import { libraryVersionBase } from "../../../lib/media"
import type { AiSource } from "../../../lib/media/ai-source"
import { looksLikeSvg } from "../../../lib/media/svg"
import { assertStorageFits } from "../../../lib/plan-limits"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles, storePublicFile } from "../../media/files"
import { apiKeyOf, retryAfterOf } from "./call-service"
import type { CallOutcome } from "./call-service"

/** The code of an edit refused by the package's storage limit. */
export const STORAGE_FULL = "storage_full"

export interface EditImageInput {
  task: string
  service: string
  /** `image_background`: what the background becomes. */
  background?: ImageBackground | null | undefined
  /** `image_scene`: the shop's scene, by its code; its description is read here. */
  scene?: string | null | undefined
  /** `image_scene`: a scene typed once (client words, cleaned again here before the call). */
  custom?: string | null | undefined
  media_id: string
}

/** How the edit ended, and the stored result file when there is one. */
export interface EditImageOutcome extends CallOutcome {
  file_id: string | null
  /** Images the service gave back, kept or not (1 or null): what a per-image price counts. */
  images: number | null
  /** What the stored result is marked as (IPTC and `media_asset.ai_source`); null without one. */
  ai_source?: AiSource | null
}

type Resolved = NonNullable<ReturnType<typeof imageTargetOf>>

/** A scene task's scene endpoint, or null: a service without one. */
const sceneOf = (resolved: Resolved | null) => sceneTargetOf(resolved?.target)

/**
 * The call this task makes: a background, or the shop's scene read from
 * its own and its packs' (the allow-list; a code not among them is refused), or one typed once.
 */
async function runFor(
  container: MedusaContainer,
  input: EditImageInput,
  task: AiTask,
  resolved: Resolved,
  connector: ImageEditConnector,
  original: { bytes: Buffer; name: string }
): Promise<{ done: ImageEditDone; source: AiSource }> {
  const run = {
    connector,
    service: resolved.service,
    original: original.bytes,
    name: original.name,
  }
  if (task.optionSource !== "scenes") {
    if (!input.background) {
      throw aiProviderError({ service: input.service, key: "ai.unknown_task", code: "no_option" })
    }
    const background = input.background
    return {
      done: await withAiBreaker(input.service, () => runImageEdit({ ...run, background })),
      source: "edited",
    }
  }
  const target = sceneOf(resolved)
  // A typed scene is cleaned again here: the job's input is not taken on trust
  const scene = input.custom
    ? customScene(input.custom)
    : input.scene
      ? await shopSceneOf(container, input.scene)
      : null
  if (!target) {
    throw aiProviderError({
      service: input.service,
      key: "ai.service_unavailable",
      code: "scene_unsupported",
    })
  }
  if (!scene) {
    throw aiProviderError({ service: input.service, key: "ai.unknown_task", code: "scene_unknown" })
  }
  const done = await withAiBreaker(input.service, () =>
    runImageScene({ ...run, setting: settingOf(scene), source: target.source })
  )
  return { done, source: target.source }
}

/** The original's stored bytes: read, never written back (adr/0071 §5). */
async function originalOf(
  container: Pick<MedusaContainer, "resolve">,
  serviceId: string,
  mediaId: string
) {
  const [asset] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets(
      { id: mediaId },
      { select: ["id", "file_id", "filename", "mime_type"], take: 1 }
    )
  if (!asset?.file_id) {
    throw aiProviderError({ service: serviceId, key: "ai.unknown_entity", code: "no_master" })
  }
  // Streamed and cut at the source limit (lib/ai/image-input.ts): a large file is never read whole
  const bytes = await readVisionSource(
    await container.resolve(Modules.FILE).getDownloadStream(asset.file_id)
  )
  if (bytes === null) {
    throw aiProviderError({ service: serviceId, key: "ai.input_unsupported", code: "image_size" })
  }
  if (looksLikeSvg(bytes)) {
    throw aiProviderError({ service: serviceId, key: "ai.input_unsupported", code: "svg" })
  }
  return { bytes, name: `${libraryVersionBase(asset.filename)}-ai` }
}

/**
 * One picture's background edit (Aşama 4; adr/0071 §8.5, §9): the key is
 * read here and nowhere else, the call goes through the service's circuit
 * breaker, the result through the upload check and the IPTC mark
 * (`runImageEdit`), and it is stored as a new public file within the
 * package's storage. No bytes enter the step's input or output: only the
 * new file's key. A failure is returned, not thrown, so its usage row is
 * written. Undone by removing the new file; the original is never touched.
 */
export async function editImage(
  container: MedusaContainer,
  input: EditImageInput
): Promise<EditImageOutcome> {
  const started = Date.now()
  const task = findAiTask(input.task)
  const resolved = imageTargetOf(input.service)
  const base: EditImageOutcome = {
    status: "failed",
    model:
      (task?.optionSource === "scenes" ? sceneOf(resolved)?.model : undefined) ??
      resolved?.target.model ??
      "",
    text: null,
    candidates: [],
    correction: null,
    problems: [],
    input_tokens: null,
    output_tokens: null,
    duration_ms: 0,
    error_key: null,
    error_code: null,
    retry_after_ms: null,
    file_id: null,
    images: null,
  }
  // Set once the service gave a result back: the call is paid for from here on
  let returned: EditImageOutcome | null = null
  try {
    if (task?.capability !== "image_edit" || !resolved) {
      throw aiProviderError({
        service: input.service,
        key: "ai.service_unavailable",
        code: "not_registered",
      })
    }
    const original = await originalOf(container, input.service, input.media_id)
    // Full already: not worth a call the shop pays for
    await assertStorageFits(container, original.bytes.length)
    const apiKey = await apiKeyOf(container, resolved.service.credentialProvider)
    if (apiKey === null) {
      throw aiProviderError({
        service: input.service,
        key: "ai.service_unavailable",
        code: "no_credentials",
      })
    }
    const connector = imageConnectorFor(input.service, apiKey)
    const { done, source } = await runFor(container, input, task, resolved, connector, original)
    returned = {
      ...base,
      input_tokens: done.usage.inputTokens ?? null,
      output_tokens: done.usage.outputTokens ?? null,
      images: 1,
      ai_source: source,
    }
    await assertStorageFits(container, done.image.buffer.length)
    const file = await storePublicFile(
      container,
      done.image.filename,
      done.image.mimeType,
      done.image.buffer
    )
    const outcome: EditImageOutcome = {
      ...returned,
      status: "succeeded",
      duration_ms: Date.now() - started,
      file_id: file.id,
    }
    return outcome
  } catch (error) {
    // A failure after the answer keeps what the service counted: the usage row prices it,
    // also when the result's download or check refused what the service gave back
    const paid = answeredUsageOf(error)
    const answered =
      returned ??
      (paid
        ? {
            ...base,
            input_tokens: paid.inputTokens ?? null,
            output_tokens: paid.outputTokens ?? null,
            images: 1,
          }
        : base)
    if (isPlanLimitError(error)) {
      // The package's storage is full: no AI key says so, the job reports `plan.limit_reached`
      const full: EditImageOutcome = {
        ...answered,
        duration_ms: Date.now() - started,
        error_code: STORAGE_FULL,
      }
      return full
    }
    const failure = failureOf(error)
    const outcome: EditImageOutcome = {
      ...answered,
      status: failure.status,
      duration_ms: Date.now() - started,
      error_key: failure.key,
      error_code: failure.code,
      retry_after_ms: retryAfterOf(error),
    }
    return outcome
  }
}

export const editImageStep = createStep(
  "ai-edit-image",
  async (input: EditImageInput, { container }) => {
    const outcome = await editImage(container, input)
    return new StepResponse(outcome, outcome.file_id)
  },
  async (fileId, { container }) => {
    if (fileId) {
      await removeFiles(container, [fileId])
    }
  }
)
