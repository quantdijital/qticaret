import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { displayName, readImage } from "../../../lib/media"
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
      const asset = await media.createMediaAssets({
        file_id: fileId,
        url,
        ...(await describe(container, fileId)),
        uploaded_by: input.uploaded_by ?? null,
        in_library: input.library ?? false,
      })
      assets.push(asset)
      undo.created.push(asset.id)
    }
    return new StepResponse(assets, undo)
  },
  async (undo, { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    if (undo?.kept.length) {
      await media.updateMediaAssets(undo.kept.map((id) => ({ id, in_library: false })))
    }
    if (undo?.created.length) {
      await media.deleteMediaAssets(undo.created)
    }
  }
)
