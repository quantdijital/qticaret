import type { MedusaContainer } from "@medusajs/framework/types"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { errorSummary, logger } from "../../../lib/logging"
import { readImage } from "../../../lib/media"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaAssetRecord } from "../../../modules/media/service"
import { publicUploadUrl } from "../../files/public-upload"
import { isMissingFile } from "../files"

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

/**
 * Product images just uploaded (cleaned by the upload check, F3.3) become
 * media assets: their URL from storage (never from the request), their
 * size read from the file. An image registered before is returned as it
 * is. A job's private result file is never an image here.
 */
export const registerMediaStep = createStep(
  "media-register-files",
  async (fileIds: string[], { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const assets: MediaAssetRecord[] = []
    const created: string[] = []
    for (const fileId of fileIds) {
      const url = await publicUploadUrl(container, fileId)
      if (!url) {
        throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.file_unknown")
      }
      const [known] = await media.listMediaAssets({ url }, { take: 1 })
      if (known) {
        assets.push(known)
        continue
      }
      const size = await sizeOf(await readFile(container, fileId))
      const asset = await media.createMediaAssets({
        file_id: fileId,
        url,
        width: size.width,
        height: size.height,
      })
      assets.push(asset)
      created.push(asset.id)
    }
    return new StepResponse(assets, created)
  },
  async (created, { container }) => {
    if (created?.length) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).deleteMediaAssets(created)
    }
  }
)
