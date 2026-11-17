import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { retryKeptSince } from "../../../lib/media/video/limits"
import { PROCESSING_FAILED } from "../../../lib/media/video/transcode-errors"
import type { MediaVideoRecord } from "../../../modules/media/service"

type Resolver = Pick<MedusaContainer, "resolve">

/** A product's videos (adr/0069), or null when there is no such product. */
export async function productVideos(
  container: Resolver,
  productId: string
): Promise<MediaVideoRecord[] | null> {
  const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
    entity: "product",
    fields: ["id", "media_videos.*"],
    filters: { id: productId },
  })
  const product = data[0] as { media_videos?: (MediaVideoRecord | null)[] | null } | undefined
  if (!product) {
    return null
  }
  return (product.media_videos ?? [])
    .filter((video): video is MediaVideoRecord => video !== null)
    .sort(
      (a, b) =>
        a.position - b.position ||
        new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    )
}

/** Every file a video holds in storage: its source, its outputs and its poster's. */
export const videoFileIds = (
  video: Pick<MediaVideoRecord, "source_file_id" | "output_file_ids" | "poster_file_ids">
): string[] => [
  ...(video.source_file_id ? [video.source_file_id] : []),
  ...(video.output_file_ids ?? []),
  ...(video.poster_file_ids ?? []),
]

/**
 * What the panel reads of a video: never a storage key, the uploader or
 * bookkeeping; the error as its i18n key. Outputs and poster are the
 * public addresses the storefront will read too (§6).
 */
export function adminVideoView(video: MediaVideoRecord) {
  return {
    id: video.id,
    kind: video.kind,
    status: video.status,
    title: video.title,
    position: video.position,
    width: video.width,
    height: video.height,
    duration_ms: video.duration_ms,
    source_format: video.source_format,
    source_bytes: video.source_bytes,
    stored_bytes: video.stored_bytes,
    outputs: video.outputs,
    poster: video.poster,
    youtube_id: video.youtube_id,
    error_code: video.error_code,
    retryable: canRetryVideo(video),
    created_at: video.created_at,
  }
}

/**
 * Whether "Yeniden dene" would take the video (slice 3): a clip the
 * infrastructure failed, its source still kept (`retryVideo`'s own terms).
 */
export function canRetryVideo(
  video: Pick<MediaVideoRecord, "kind" | "status" | "error_code" | "source_file_id" | "updated_at">,
  now: number = Date.now()
): boolean {
  return (
    video.kind === "upload" &&
    video.status === "failed" &&
    video.error_code === PROCESSING_FAILED &&
    video.source_file_id !== null &&
    new Date(video.updated_at).getTime() > retryKeptSince(now).getTime()
  )
}

export type AdminVideoView = ReturnType<typeof adminVideoView>
