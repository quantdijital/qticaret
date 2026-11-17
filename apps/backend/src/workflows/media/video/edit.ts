import { WorkflowResponse, createWorkflow, transform } from "@medusajs/framework/workflows-sdk"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { emitEventStep } from "@medusajs/medusa/core-flows"
import { ConflictError } from "../../../lib/errors"
import { retryKeptSince } from "../../../lib/media/video/limits"
import { PROCESSING_FAILED } from "../../../lib/media/video/transcode-errors"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaVideoRecord, RetriedVideo } from "../../../modules/media/service"
import { findProductVideoStep } from "./steps"
import { MEDIA_VIDEO_UPLOADED } from "./workflows"

/**
 * A product video's own changes from the panel (adr/0069 §10, slice 3):
 * its title, and "Yeniden dene" for a clip the infrastructure failed.
 */

const media = (container: { resolve: (key: string) => unknown }) =>
  container.resolve(MEDIA_MODULE) as MediaModuleService

/** The title written; undone by putting the one before back. */
export const updateVideoTitleStep = createStep(
  "media-video-update-title",
  async (input: { video: MediaVideoRecord; title: string | null }, { container }) => {
    await media(container).updateMediaVideos({ id: input.video.id, title: input.title })
    return new StepResponse(
      { ...input.video, title: input.title },
      { id: input.video.id, title: input.video.title }
    )
  },
  async (before, { container }) => {
    if (before) {
      await media(container).updateMediaVideos({ id: before.id, title: before.title })
    }
  }
)

/** A video's title (the player's accessible name; empty: the product's name). */
export const updateProductVideoWorkflow = createWorkflow(
  "media-video-update",
  (input: { product_id: string; video_id: string; title: string | null }) => {
    const video = findProductVideoStep(
      transform({ input }, ({ input }) => ({
        product_id: input.product_id,
        video_id: input.video_id,
      }))
    )
    const updated = updateVideoTitleStep(
      transform({ input, video }, ({ input, video }) => ({ video, title: input.title }))
    )
    return new WorkflowResponse(updated)
  }
)

/**
 * Why a video cannot be retried, in the panel's words: its source is gone
 * (swept after a week, or never kept), or it is not a clip the
 * infrastructure failed.
 */
export function retryRefusal(video: Pick<MediaVideoRecord, "kind" | "status" | "error_code">) {
  const infraFailure =
    video.kind === "upload" && video.status === "failed" && video.error_code === PROCESSING_FAILED
  return infraFailure ? "video.source_gone" : "video.retry_unavailable"
}

/**
 * The clip back in the queue (`retryVideo`: `failed` with
 * `video.processing_failed`, its source kept); `attempts` kept, the cap
 * counted from now. Undone as `failed` again while no job took it.
 */
export const retryVideoStep = createStep(
  "media-video-retry",
  async (video: MediaVideoRecord, { container }) => {
    const retried = await media(container).retryVideo(
      video.id,
      PROCESSING_FAILED,
      retryKeptSince(Date.now())
    )
    if (!retried) {
      throw new ConflictError(retryRefusal(video))
    }
    return new StepResponse(retried, { id: video.id, retried })
  },
  async (undo: { id: string; retried: RetriedVideo } | undefined, { container }) => {
    if (undo) {
      await media(container).unretryVideo(undo.id, PROCESSING_FAILED, undo.retried)
    }
  }
)

/** "Yeniden dene": the clip waits for the job again, which `media.video_uploaded` wakes. */
export const retryProductVideoWorkflow = createWorkflow(
  "media-video-retry-product",
  (input: { product_id: string; video_id: string }) => {
    const video = findProductVideoStep(input)
    const retried = retryVideoStep(video)
    emitEventStep({
      eventName: MEDIA_VIDEO_UPLOADED,
      data: transform({ video }, ({ video }) => ({ id: video.id })),
    })
    return new WorkflowResponse(retried)
  }
)
