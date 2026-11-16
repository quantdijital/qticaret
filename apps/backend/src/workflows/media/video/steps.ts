import { createReadStream } from "node:fs"
import { pipeline } from "node:stream/promises"
import { MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { errorSummary, logger } from "../../../lib/logging"
import { VIDEOS_PER_PRODUCT } from "../../../lib/media/video/limits"
import type { VideoSourceFormat } from "../../../lib/media/video/signature"
import { openingStatus } from "../../../lib/media/video/status"
import { assertStorageWithinLimit, forgetUsage } from "../../../lib/plan-limits"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaVideoRecord } from "../../../modules/media/service"
import { removeFiles } from "../files"
import { productVideos, videoFileIds } from "./read"

// The source as stored: private, named by what its bytes are (adr/0069 §3)
const SOURCE_FILE: Readonly<Record<VideoSourceFormat, { name: string; mime: string }>> = {
  mp4: { name: "video-kaynak.mp4", mime: "video/mp4" },
  mov: { name: "video-kaynak.mov", mime: "video/quicktime" },
  webm: { name: "video-kaynak.webm", mime: "video/webm" },
  gif: { name: "video-kaynak.gif", mime: "image/gif" },
}

const media = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(MEDIA_MODULE) as MediaModuleService

/**
 * The product exists and has room for one more video (Kararlar 2: two at
 * most, uploads and YouTube links together). Read under the product's
 * video lock, so two uploads at once cannot both take the last place.
 */
export const checkVideoRoomStep = createStep(
  "media-video-check-room",
  async (productId: string, { container }) => {
    const videos = await productVideos(container, productId)
    if (videos === null) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "products.unknown")
    }
    if (videos.length >= VIDEOS_PER_PRODUCT) {
      throw new ValidationError("video.limit_per_product", { field: "file" })
    }
    return new StepResponse(videos.length)
  }
)

export interface StoreVideoSourceInput {
  path: string
  format: VideoSourceFormat
}

/**
 * The checked clip streamed from its temporary file to private storage
 * (never read whole into memory). Undone by removing the stored file.
 */
export const storeVideoSourceStep = createStep(
  "media-video-store-source",
  async ({ path, format }: StoreVideoSourceInput, { container }) => {
    const file = SOURCE_FILE[format]
    const upload = await container
      .resolve(Modules.FILE)
      .getUploadStream({ filename: file.name, mimeType: file.mime, access: "private" })
    try {
      await pipeline(createReadStream(path), upload.writeStream)
      await upload.promise
    } catch (error) {
      logger.warn({ event: "media.video_not_stored", err: errorSummary(error) })
      await removeFiles(container, [upload.fileKey])
      throw error
    }
    return new StepResponse(upload.fileKey, upload.fileKey)
  },
  async (fileKey, { container }) => {
    if (fileKey) {
      await removeFiles(container, [fileKey])
    }
  }
)

export interface CreateVideoInput {
  source_file_id: string
  source_bytes: number
  source_format: VideoSourceFormat
  title: string | null
  width: number
  height: number
  duration_ms: number
  uploaded_by: string | null
}

/** The video's record, `uploaded`: the source alone counts against storage until processed. */
export const createVideoRecordStep = createStep(
  "media-video-create",
  async (input: CreateVideoInput, { container }) => {
    const video = await media(container).createMediaVideos({
      ...input,
      kind: "upload",
      status: openingStatus("upload"),
      position: 1,
      stored_bytes: input.source_bytes,
      attempts: 0,
    })
    return new StepResponse(video, video.id)
  },
  async (id, { container }) => {
    if (id) {
      await media(container).deleteMediaVideos([id])
    }
  }
)

/**
 * Counted again with the new video in (adr/0061 Ek C14 review H1): two
 * uploads at once cannot pass the package's storage limit between them.
 * Past it, the workflow's compensations remove the record and the file.
 */
export const checkVideoStorageStep = createStep(
  "media-video-check-storage",
  async (bytes: number, { container }) => {
    await assertStorageWithinLimit(container, bytes)
    forgetUsage("storage_mb")
    return new StepResponse(bytes)
  }
)

/** The product's video by its id, or 404: a video of another product is not this one's. */
export const findProductVideoStep = createStep(
  "media-video-find",
  async ({ product_id, video_id }: { product_id: string; video_id: string }, { container }) => {
    const videos = await productVideos(container, product_id)
    const video = videos?.find((each) => each.id === video_id)
    if (!video) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "video.unknown")
    }
    return new StepResponse(video)
  }
)

/**
 * A video's record taken away (soft deleted), undone by restoring it. Before
 * its files (security review D4): a failure here leaves the video whole on
 * its product, never a record whose files are gone.
 */
export const softDeleteVideoStep = createStep(
  "media-video-soft-delete",
  async (id: string, { container }) => {
    await media(container).softDeleteMediaVideos([id])
    forgetUsage("storage_mb")
    return new StepResponse(id, id)
  },
  async (id, { container }) => {
    if (id) {
      await media(container).restoreMediaVideos([id])
      forgetUsage("storage_mb")
    }
  }
)

/**
 * The removed video's files go (adr/0069 §11), the last step: nothing can
 * be undone after it, and it does not fail. Storage refusing, or the
 * record not marked, leaves the removed record naming its files: the
 * nightly sweep tries again.
 */
export const removeVideoFilesStep = createStep(
  "media-video-remove-files",
  async (video: MediaVideoRecord, { container }) => {
    const removed = await removeFiles(container, videoFileIds(video))
    if (!removed) {
      logger.warn({ event: "media.video_files_kept", video_id: video.id })
      return new StepResponse(false)
    }
    try {
      await media(container).forgetVideoFiles(video.id)
    } catch (error) {
      logger.warn({ event: "media.video_files_not_forgotten", err: errorSummary(error) })
    }
    return new StepResponse(true)
  }
)
