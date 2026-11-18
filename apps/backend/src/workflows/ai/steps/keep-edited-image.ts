import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { isPlanLimitError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles } from "../../media/files"
import { registerMedia, undoRegistration } from "../../media/steps/register-media"
import type { RegisterMediaUndo } from "../../media/steps/register-media"
import { STORAGE_FULL } from "./edit-image"
import type { EditImageOutcome } from "./edit-image"

/** The code of a result the service gave back that could not be kept as a media record. */
export const RESULT_NOT_KEPT = "result_not_kept"

export interface KeepEditedImageInput {
  outcome: EditImageOutcome
  /** The original picture's record. */
  media_id: string
  user_id: string
}

/** The edit's outcome with the new record's id as its text. */
export type KeptImage = EditImageOutcome

/**
 * The stored result becomes a media record beside the original
 * (`ai_source: edited`, `derived_from_id`; out of the library, on no
 * product, counted in the package's storage). Should that fail (the
 * storage filled meanwhile, the database), the stored file is removed
 * here and the attempt goes on as failed, so its usage row is still
 * written (altın kural 4): the service was paid. Undone, when a later
 * step fails, by removing the new record; the file goes with the edit
 * step's own compensation.
 */
/**
 * The stored result removed, unless a media record still names it (the
 * registration's own undo failed part-way): a record must never point at
 * a file that is gone. Then the file stays and the nightly sweep's rules
 * apply to the record; only a warning is logged.
 */
async function removeUnrecorded(container: MedusaContainer, fileId: string): Promise<void> {
  let left: number
  try {
    left = (
      await container
        .resolve<MediaModuleService>(MEDIA_MODULE)
        .listMediaAssets({ file_id: fileId }, { select: ["id"], take: 1 })
    ).length
  } catch (error) {
    // Unknown whether a record is left: keeping the file is the safe side
    logger.warn({ event: "ai.image_edit_file_kept", reason: "unchecked", err: errorSummary(error) })
    return
  }
  if (left > 0) {
    logger.warn({ event: "ai.image_edit_file_kept", reason: "record_left" })
    return
  }
  await removeFiles(container, [fileId])
}

export async function keepEditedImage(
  container: MedusaContainer,
  input: KeepEditedImageInput
): Promise<{ kept: KeptImage; undo: RegisterMediaUndo | null }> {
  const { outcome } = input
  if (!outcome.file_id) {
    return { kept: { ...outcome, text: null }, undo: null }
  }
  try {
    const { assets, undo } = await registerMedia(container, {
      file_ids: [outcome.file_id],
      library: false,
      uploaded_by: input.user_id,
      origin: { ai_source: "edited", derived_from_id: input.media_id },
    })
    return { kept: { ...outcome, text: assets[0]?.id ?? null }, undo }
  } catch (error) {
    await removeUnrecorded(container, outcome.file_id)
    logger.warn({ event: "ai.image_edit_not_kept", err: errorSummary(error) })
    const kept: KeptImage = {
      ...outcome,
      status: "failed",
      text: null,
      file_id: null,
      error_key: null,
      // `images` stays: the service gave the picture back and was paid
      error_code: isPlanLimitError(error) ? STORAGE_FULL : RESULT_NOT_KEPT,
    }
    return { kept, undo: null }
  }
}

export const keepEditedImageStep = createStep(
  "ai-keep-edited-image",
  async (input: KeepEditedImageInput, { container }) => {
    const { kept, undo } = await keepEditedImage(container, input)
    return new StepResponse(kept, undo)
  },
  async (undo, { container }) => {
    if (undo) {
      await undoRegistration(container.resolve<MediaModuleService>(MEDIA_MODULE), undo)
    }
  }
)
