import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ConflictError, RetryableError } from "../../../lib/errors"
import { prepareImage } from "../../../lib/media"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles, storePublicFile } from "../files"
import { mediaImportFetch, nameFromAddress } from "../import-fetch"
import { mediaUses } from "../usage"

/**
 * An image at an address the shop gave, stored as an upload is (F3.3):
 * fetched under the SSRF rules, checked by its bytes, cleaned. Its storage
 * key; the file is removed again if a later step fails.
 */
export const storeImportedImageStep = createStep(
  "media-store-imported",
  async (input: { url: string }, { container }) => {
    const bytes = await mediaImportFetch.get(input.url)
    const image = await prepareImage(bytes, nameFromAddress(input.url), "url")
    const file = await storePublicFile(container, image.filename, image.mimeType, image.buffer)
    return new StepResponse(file.id, file.id)
  },
  async (fileId, { container }) => {
    if (fileId) {
      await removeFiles(container, [fileId])
    }
  }
)

export interface DoomedMedia {
  id: string
  file_id: string | null
  derivative_file_ids: string[]
}

/**
 * An image no page, product, logo, message or order shows: anything else
 * is refused (409 `media.in_use`), its detail says where it is used. Reads only.
 */
export const assertMediaUnusedStep = createStep(
  "media-assert-unused",
  async (id: string, { container }) => {
    const [asset] = await container
      .resolve<MediaModuleService>(MEDIA_MODULE)
      .listMediaAssets({ id }, { take: 1 })
    if (!asset) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.unknown")
    }
    const used = await mediaUses(container, asset)
    if (used.length > 0) {
      throw new ConflictError("media.in_use")
    }
    const doomed: DoomedMedia = {
      id: asset.id,
      file_id: asset.file_id,
      derivative_file_ids: asset.derivative_file_ids ?? [],
    }
    return new StepResponse(doomed)
  }
)

/** The record leaves the library first; brought back if its files cannot go. */
export const softDeleteMediaStep = createStep(
  "media-soft-delete",
  async (id: string, { container }) => {
    await container.resolve<MediaModuleService>(MEDIA_MODULE).softDeleteMediaAssets([id])
    return new StepResponse(id, id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).restoreMediaAssets([id])
    }
  }
)

/**
 * The image's files: its master (unless another record shares it) and its
 * versions. Storage refusing fails the delete, so the record comes back and
 * a later try removes them; the last step, as files cannot be put back.
 */
export const removeDeletedMediaFilesStep = createStep(
  "media-remove-deleted-files",
  async (doomed: DoomedMedia, { container }) => {
    const [sharing] = doomed.file_id
      ? await container
          .resolve<MediaModuleService>(MEDIA_MODULE)
          .listMediaAssets(
            { file_id: doomed.file_id, id: { $ne: doomed.id } },
            { select: ["id"], take: 1 }
          )
      : []
    const files = [
      ...(doomed.file_id && !sharing ? [doomed.file_id] : []),
      ...doomed.derivative_file_ids,
    ]
    if (!(await removeFiles(container, files))) {
      throw new RetryableError("media.files_not_removed")
    }
    return new StepResponse(files.length)
  }
)
