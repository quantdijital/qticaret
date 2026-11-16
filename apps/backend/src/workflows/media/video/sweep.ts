import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { forgetUsage } from "../../../lib/plan-limits"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles } from "../files"
import { videoFileIds } from "./read"

const PAGE = 500
const DAY_MS = 24 * 60 * 60 * 1000
// adr/0069 §1: a failed clip's source is kept a week for "Yeniden dene"
const FAILED_SOURCE_KEPT_MS = 7 * DAY_MS

interface VideoRow {
  id: string
  status: string
  created_at: string | Date
  updated_at: string | Date
  source_file_id: string | null
  source_bytes: number | null
  stored_bytes: number
  output_file_ids: string[] | null
  poster_file_ids: string[] | null
  product?: { id: string } | null
}

async function readVideos(container: MedusaContainer): Promise<VideoRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows: VideoRow[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "media_video",
      fields: [
        "id",
        "status",
        "created_at",
        "updated_at",
        "source_file_id",
        "source_bytes",
        "stored_bytes",
        "output_file_ids",
        "poster_file_ids",
        "product.id",
      ],
      pagination: { skip, take: PAGE, order: { id: "ASC" } },
    })
    rows.push(...(data as VideoRow[]))
    if (data.length < PAGE) {
      return rows
    }
  }
}

export interface VideoSweep {
  removed: number
  files_removed: number
  sources_removed: number
}

/**
 * The nightly tidy of videos (adr/0069 §11): a video without a product for
 * a day (its product deleted) is removed, the record first (soft deleted)
 * and then its files, as a removal from the panel; a removed video whose
 * files storage refused has them tried again; a failed clip's source goes
 * after a week. A refusal is tried again the next night.
 */
export const sweepVideosStep = createStep(
  "media-video-sweep",
  async (now: number, { container }) => {
    const service = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const result: VideoSweep = { removed: 0, files_removed: 0, sources_removed: 0 }
    for (const video of await readVideos(container)) {
      const age = now - new Date(video.created_at).getTime()
      if (!video.product?.id && age > DAY_MS) {
        await service.softDeleteMediaVideos([video.id])
        result.removed += 1
        continue
      }
      const idle = now - new Date(video.updated_at).getTime()
      if (video.status === "failed" && video.source_file_id && idle > FAILED_SOURCE_KEPT_MS) {
        if (await removeFiles(container, [video.source_file_id])) {
          await service.updateMediaVideos({
            id: video.id,
            source_file_id: null,
            stored_bytes: Math.max(0, video.stored_bytes - (video.source_bytes ?? 0)),
          })
          result.sources_removed += 1
        }
      }
    }
    // Removed records (just now, or a refused removal before) whose files are still named
    for (const left of await service.videosWithFilesLeft()) {
      if (await removeFiles(container, videoFileIds(left))) {
        await service.forgetVideoFiles(left.id)
        result.files_removed += 1
      }
    }
    if (result.removed + result.files_removed + result.sources_removed > 0) {
      forgetUsage("storage_mb")
    }
    return new StepResponse(result)
  }
)
