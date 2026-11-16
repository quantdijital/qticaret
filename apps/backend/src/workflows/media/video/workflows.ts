import { Modules } from "@medusajs/framework/utils"
import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  dismissRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import type { VideoSourceFormat } from "../../../lib/media/video/signature"
import { MEDIA_MODULE } from "../../../modules/media"
import {
  checkVideoRoomStep,
  checkVideoStorageStep,
  createVideoRecordStep,
  findProductVideoStep,
  removeVideoStep,
  storeVideoSourceStep,
} from "./steps"
import { sweepVideosStep } from "./sweep"

/** Emitted after a clip is stored and waits for the transcoding job: `{ id }` (adr/0069 §4). */
export const MEDIA_VIDEO_UPLOADED = "media.video_uploaded"

// One product's videos change one at a time: the count of two holds under it
const productLock = (productId: string) => `media:video:product:${productId}`
const LOCK = { timeout: 30, ttl: 300 }

export interface UploadProductVideoInput {
  product_id: string
  /** The checked clip's temporary file (lib/media/video/receive.ts). */
  path: string
  bytes: number
  format: VideoSourceFormat
  width: number
  height: number
  duration_ms: number
  title: string | null
  uploaded_by: string | null
}

/**
 * A checked clip becomes the product's video (adr/0069 §3): under the
 * product's lock, room is checked (two at most), the source is streamed to
 * private storage, the record opens `uploaded` and is linked, and storage
 * is counted again with it in. Any failure undoes what was done: the link,
 * the record, the stored file. `media.video_uploaded` asks the job to
 * process it (slice 2).
 */
export const uploadProductVideoWorkflow = createWorkflow(
  "media-video-upload",
  (input: UploadProductVideoInput) => {
    const key = transform({ input }, ({ input }) => productLock(input.product_id))
    acquireLockStep({ key, ...LOCK })
    checkVideoRoomStep(transform({ input }, ({ input }) => input.product_id))
    const fileId = storeVideoSourceStep(
      transform({ input }, ({ input }) => ({ path: input.path, format: input.format }))
    )
    const video = createVideoRecordStep(
      transform({ input, fileId }, ({ input, fileId }) => ({
        source_file_id: fileId,
        source_bytes: input.bytes,
        source_format: input.format,
        title: input.title,
        width: input.width,
        height: input.height,
        duration_ms: input.duration_ms,
        uploaded_by: input.uploaded_by,
      }))
    )
    createRemoteLinkStep(
      transform({ input, video }, ({ input, video }) => [
        {
          [Modules.PRODUCT]: { product_id: input.product_id },
          [MEDIA_MODULE]: { media_video_id: video.id },
        },
      ])
    )
    checkVideoStorageStep(transform({ input }, ({ input }) => input.bytes))
    releaseLockStep({ key })
    emitEventStep({
      eventName: MEDIA_VIDEO_UPLOADED,
      data: transform({ video }, ({ video }) => ({ id: video.id })),
    })
    return new WorkflowResponse(video)
  }
)

/**
 * A video taken off its product (adr/0069 §11): the link goes, then its
 * files, then the record. A video of another product is a 404.
 */
export const removeProductVideoWorkflow = createWorkflow(
  "media-video-remove",
  (input: { product_id: string; video_id: string }) => {
    const key = transform({ input }, ({ input }) => productLock(input.product_id))
    acquireLockStep({ key, ...LOCK })
    const video = findProductVideoStep(input)
    dismissRemoteLinkStep(
      transform({ input, video }, ({ input, video }) => [
        {
          [Modules.PRODUCT]: { product_id: input.product_id },
          [MEDIA_MODULE]: { media_video_id: video.id },
        },
      ])
    )
    const removed = removeVideoStep(video)
    releaseLockStep({ key })
    return new WorkflowResponse(removed)
  }
)

/** The nightly tidy of videos left without a product and of week-old failed sources. */
export const sweepProductVideosWorkflow = createWorkflow(
  "media-video-sweep",
  (input: { now: number }) => {
    const result = sweepVideosStep(transform({ input }, ({ input }) => input.now))
    return new WorkflowResponse(result)
  }
)
