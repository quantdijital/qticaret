import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { isValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { assertStorageWithinLimit, forgetUsage } from "../../../lib/plan-limits"
import { displayName, readImage } from "../../../lib/media"
import { SVG_MIME, looksLikeSvg, sanitizeSvg } from "../../../lib/media/svg"
import { UPLOAD_MEDIA_TYPES, readImageInfo } from "../../../lib/security/upload"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaAssetRecord } from "../../../modules/media/service"
import { publicUploadUrl } from "../../files/public-upload"
import { isMissingFile } from "../files"

export interface RegisterMediaInput {
  file_ids: string[]
  /** Put in the library on purpose (its page, a picker): kept until deleted there. */
  library?: boolean
  /** The staff member uploading; null for a job (an import from an old site). */
  uploaded_by?: string | null
}

/** The file's bytes; a file storage does not have is unknown, storage failing is not. */
async function readFile(container: MedusaContainer, fileId: string): Promise<Buffer> {
  try {
    return await container.resolve(Modules.FILE).getAsBuffer(fileId)
  } catch (error) {
    if (isMissingFile(error)) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.file_unknown")
    }
    logger.warn({ event: "media.file_unreadable", err: errorSummary(error) })
    throw error
  }
}

async function sizeOf(bytes: Buffer) {
  try {
    return await readImage(bytes).metadata()
  } catch {
    // Not an image (an uploaded CSV): not a product image either
    throw new MedusaError(MedusaError.Types.INVALID_DATA, "media.not_an_image")
  }
}

/** What the library shows of a stored file: its name, type, bytes and size. */
async function describe(container: MedusaContainer, fileId: string) {
  const bytes = await readFile(container, fileId)
  if (readImageInfo(bytes) === null && looksLikeSvg(bytes)) {
    // Read again by the cleaner, for two things: its size (the library keeps it), and
    // proof that storage holds what the upload check wrote. The cleaner gives back the
    // same file for one it wrote; one it would change (put in storage some other way) is
    // no image of ours, and no record is made of it
    let svg
    try {
      svg = await sanitizeSvg(bytes)
    } catch (error) {
      // A cleaner that could not start is ours to see, not the file's refusal
      if (!isValidationError(error)) {
        throw error
      }
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "media.not_an_image")
    }
    if (!svg.buffer.equals(bytes)) {
      throw new MedusaError(MedusaError.Types.INVALID_DATA, "media.not_an_image")
    }
    return {
      filename: displayName(fileId),
      mime_type: SVG_MIME,
      size: bytes.length,
      width: svg.width,
      height: svg.height,
    }
  }
  const size = await sizeOf(bytes)
  const type = readImageInfo(bytes)?.type
  return {
    filename: displayName(fileId),
    mime_type: type ? UPLOAD_MEDIA_TYPES[type].mime : null,
    size: bytes.length,
    width: size.width,
    height: size.height,
  }
}

interface Undo {
  created: string[]
  /** Records that were there and joined the library now. */
  kept: string[]
}

/**
 * Images just uploaded (cleaned by the upload check, F3.3) become media
 * assets: their URL from storage (never from the request), their name,
 * type, bytes and size read from the file. An image registered before is
 * returned as it is (put in the library when asked). A job's private
 * result file is never an image here.
 */
export const registerMediaStep = createStep(
  "media-register-files",
  async (input: RegisterMediaInput, { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const assets: MediaAssetRecord[] = []
    const undo: Undo = { created: [], kept: [] }
    // The new records' bytes: what this registration adds to the library's storage
    let added = 0
    // A step that throws is not compensated: a failure part-way (a file storage
    // lacks, one that is no image, past the storage limit) undoes here what the
    // earlier turns made, never leaving records with no file counted in the quota
    try {
      for (const fileId of input.file_ids) {
        const url = await publicUploadUrl(container, fileId)
        if (!url) {
          throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.file_unknown")
        }
        const [known] = await media.listMediaAssets({ url }, { take: 1 })
        if (known) {
          if (input.library && !known.in_library) {
            assets.push(await media.updateMediaAssets({ id: known.id, in_library: true }))
            undo.kept.push(known.id)
          } else {
            assets.push(known)
          }
          continue
        }
        const described = await describe(container, fileId)
        const asset = await media.createMediaAssets({
          file_id: fileId,
          url,
          ...described,
          uploaded_by: input.uploaded_by ?? null,
          in_library: input.library ?? false,
        })
        assets.push(asset)
        undo.created.push(asset.id)
        added += described.size
      }
      // adr/0061 Ek C14 review H1: counted again with the new records in
      await assertStorageWithinLimit(container, added)
    } catch (error) {
      await undoRegistration(media, undo)
      throw error
    }
    if (added > 0) {
      forgetUsage("storage_mb")
    }
    return new StepResponse(assets, undo)
  },
  async (undo, { container }) => {
    await undoRegistration(container.resolve<MediaModuleService>(MEDIA_MODULE), undo)
  }
)

async function undoRegistration(media: MediaModuleService, undo: Undo | undefined): Promise<void> {
  if (undo?.kept.length) {
    await media.updateMediaAssets(undo.kept.map((id) => ({ id, in_library: false })))
  }
  if (undo?.created.length) {
    await media.deleteMediaAssets(undo.created)
  }
}
