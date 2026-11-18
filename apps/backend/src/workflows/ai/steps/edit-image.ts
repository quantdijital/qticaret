import type { MedusaContainer } from "@medusajs/framework/types"
import { Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { withAiBreaker } from "../../../lib/ai/breaker"
import { isPlanLimitError } from "../../../lib/errors"
import { aiProviderError } from "../../../lib/ai/errors"
import { imageConnectorFor, imageTargetOf } from "../../../lib/ai/image-connector-of"
import { failureOf } from "../../../lib/ai/outcome"
import { findAiTask } from "../../../lib/ai/registry/tasks"
import type { ImageBackground } from "../../../lib/ai/registry/services"
import { runImageEdit } from "../../../lib/ai/run-image"
import { libraryVersionBase } from "../../../lib/media"
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
  background: ImageBackground
  media_id: string
}

/** How the edit ended, and the stored result file when there is one. */
export interface EditImageOutcome extends CallOutcome {
  file_id: string | null
  /** Images the service gave back, kept or not (1 or null): what a per-image price counts. */
  images: number | null
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
  const bytes = await container.resolve(Modules.FILE).getAsBuffer(asset.file_id)
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
    model: resolved?.target.model ?? "",
    text: null,
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
    const done = await withAiBreaker(input.service, () =>
      runImageEdit({
        connector,
        service: resolved.service,
        original: original.bytes,
        name: original.name,
        background: input.background,
      })
    )
    returned = {
      ...base,
      input_tokens: done.usage.inputTokens ?? null,
      output_tokens: done.usage.outputTokens ?? null,
      images: 1,
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
    // A failure after the answer keeps what the service counted: the usage row prices it
    const answered = returned ?? base
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
