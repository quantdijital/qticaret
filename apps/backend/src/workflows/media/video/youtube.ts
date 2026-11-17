import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys, Modules } from "@medusajs/framework/utils"
import {
  StepResponse,
  WorkflowResponse,
  createStep,
  createWorkflow,
  transform,
} from "@medusajs/framework/workflows-sdk"
import {
  acquireLockStep,
  createRemoteLinkStep,
  emitEventStep,
  releaseLockStep,
} from "@medusajs/medusa/core-flows"
import { errorSummary, logger } from "../../../lib/logging"
import { makePoster, videoFileBase } from "../../../lib/media/video/poster"
import { openingStatus } from "../../../lib/media/video/status"
import { validateUpload } from "../../../lib/security/upload"
import { toSlug } from "../../../lib/seo/slug"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles } from "../files"
import { storePosterImages } from "./outputs"
import type { StoredPoster } from "./outputs"
import { productVideos } from "./read"
import { checkVideoRoomStep, checkVideoStorageStep } from "./steps"
import { MEDIA_VIDEO_READY } from "./transcode"
import { fetchYoutubePoster } from "./youtube-fetch"

// The same lock as an upload's and a removal's (workflows.ts): the count of two holds
const productLock = (productId: string) => `media:video:product:${productId}`
const LOCK = { timeout: 30, ttl: 300 }

export interface AddYoutubeVideoInput {
  product_id: string
  /** The 11-character id, already taken from the link (`youtubeIdOf`). */
  youtube_id: string
  /** The shop's title, else YouTube's (oEmbed), else null: the product's name stands in. */
  title: string | null
  uploaded_by: string | null
}

/** `{slug}-video-{n}`: named as the product's next video, as a clip's poster is. */
async function posterBase(container: MedusaContainer, productId: string): Promise<string> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "handle"],
    filters: { id: productId },
  })
  const handle = (data[0] as { handle?: string | null } | undefined)?.handle ?? ""
  const siblings = (await productVideos(container, productId)) ?? []
  return videoFileBase(toSlug(handle, 60) || "urun", siblings.length + 1)
}

/**
 * The video's cover copied into our storage (adr/0069 §8): YouTube's
 * largest, checked by its bytes as an upload is (`validateUpload`), then
 * the image pipeline's poster (`sanitizeImage` + WebP/AVIF versions). It
 * never fails the workflow: without a cover the record still opens and
 * the storefront shows the product's first picture. Undone by removing
 * what it stored.
 */
export const storeYoutubePosterStep = createStep(
  "media-video-youtube-poster",
  async (input: { product_id: string; youtube_id: string }, { container }) => {
    const bytes = await fetchYoutubePoster(input.youtube_id)
    if (!bytes) {
      return new StepResponse<StoredPoster | null, string[]>(null, [])
    }
    const stored: string[] = []
    try {
      validateUpload({ buffer: bytes, originalname: "kapak.jpg" })
      const images = await makePoster(bytes)
      const base = await posterBase(container, input.product_id)
      const poster = await storePosterImages(container, base, images, (id) => {
        stored.push(id)
      })
      return new StepResponse<StoredPoster | null, string[]>(poster, poster.poster_file_ids)
    } catch (error) {
      logger.warn({ event: "media.youtube_poster_not_stored", err: errorSummary(error) })
      await removeFiles(container, stored)
      return new StepResponse<StoredPoster | null, string[]>(null, [])
    }
  },
  async (fileIds, { container }) => {
    if (fileIds && fileIds.length > 0) {
      await removeFiles(container, fileIds)
    }
  }
)

/** The YouTube video's record: ready at once, only its cover in storage (adr/0069 §8). */
export const createYoutubeRecordStep = createStep(
  "media-video-youtube-create",
  async (
    input: Omit<AddYoutubeVideoInput, "product_id"> & { poster: StoredPoster | null },
    { container }
  ) => {
    const video = await container.resolve<MediaModuleService>(MEDIA_MODULE).createMediaVideos({
      kind: "youtube",
      status: openingStatus("youtube"),
      youtube_id: input.youtube_id,
      title: input.title,
      position: 1,
      poster: input.poster?.poster ?? null,
      poster_file_ids: input.poster?.poster_file_ids ?? null,
      stored_bytes: input.poster?.bytes ?? 0,
      duration_ms: null,
      processed_at: new Date(),
      attempts: 0,
      uploaded_by: input.uploaded_by,
    })
    return new StepResponse(video, video.id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).deleteMediaVideos([id])
    }
  }
)

/**
 * A YouTube video added to a product (adr/0069 §8). Its cover is copied
 * first, outside the product's lock (a download may take seconds); then,
 * under it, room is checked again (two at most, uploads and YouTube
 * together), the record opens `ready` and is linked, and storage is
 * counted with the cover in. Any failure undoes the link, the record and
 * the cover's files. `media.video_ready` as for a processed clip.
 */
export const addYoutubeVideoWorkflow = createWorkflow(
  "media-video-youtube",
  (input: AddYoutubeVideoInput) => {
    const poster = storeYoutubePosterStep(
      transform({ input }, ({ input }) => ({
        product_id: input.product_id,
        youtube_id: input.youtube_id,
      }))
    )
    const key = transform({ input }, ({ input }) => productLock(input.product_id))
    acquireLockStep({ key, ...LOCK })
    checkVideoRoomStep(transform({ input }, ({ input }) => input.product_id))
    const video = createYoutubeRecordStep(
      transform({ input, poster }, ({ input, poster }) => ({
        youtube_id: input.youtube_id,
        title: input.title,
        uploaded_by: input.uploaded_by,
        poster,
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
    checkVideoStorageStep(transform({ poster }, ({ poster }) => poster?.bytes ?? 0))
    releaseLockStep({ key })
    emitEventStep({
      eventName: MEDIA_VIDEO_READY,
      data: transform({ video }, ({ video }) => ({ id: video.id })),
    })
    return new WorkflowResponse(video)
  }
)
