import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { logger } from "../../../lib/logging"
// adr/0069 §1: a failed clip's source is kept a week for "Yeniden dene"
import { FAILED_SOURCE_KEPT_MS, READY_SOURCE_GRACE_MS } from "../../../lib/media/video/limits"
import { forgetUsage } from "../../../lib/plan-limits"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import { removeFiles } from "../files"
import { videoFileIds } from "./read"

const PAGE = 500
const DAY_MS = 24 * 60 * 60 * 1000

interface VideoRow {
  id: string
  status: string
  created_at: string | Date
  source_file_id: string | null
  product?: { id: string } | null
}

async function readVideos(container: MedusaContainer): Promise<VideoRow[]> {
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const rows: VideoRow[] = []
  for (let skip = 0; ; skip += PAGE) {
    const { data } = await query.graph({
      entity: "media_video",
      fields: ["id", "status", "created_at", "source_file_id", "product.id"],
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
 * The source let go: the record stops naming it in one statement that
 * checks its state again (`release`, security review S1), and only then
 * the file is removed. Storage refusing, the unnamed file is logged by its
 * storage key (nothing secret) to be removed by hand: the lesser harm (M2).
 */
async function letGoOfSource(
  container: MedusaContainer,
  video: { id: string; source_file_id: string },
  release: () => Promise<boolean>
): Promise<boolean> {
  if (!(await release())) {
    return false
  }
  if (!(await removeFiles(container, [video.source_file_id]))) {
    logger.warn({
      event: "media.video_source_orphaned",
      video_id: video.id,
      file_id: video.source_file_id,
    })
  }
  return true
}

/**
 * The nightly tidy of videos (adr/0069 §11): a video without a product for
 * a day (its product deleted) is removed, the record first (soft deleted)
 * and then its files, as a removal from the panel; a removed video whose
 * files storage refused has them tried again; a failed clip's source goes
 * a week after it failed (`failed_at`), a ready clip's left-over source an
 * hour after it was made. The records are read up front, so each move on a
 * source checks the record again as it acts (S1). A video's product is
 * never given back (a product's link is made with its upload, never
 * later): the stale "no product" read stands. A refusal is tried again
 * the next night.
 */
export const sweepVideosStep = createStep(
  "media-video-sweep",
  async (now: number, { container }) => {
    const service = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const result: VideoSweep = { removed: 0, files_removed: 0, sources_removed: 0 }
    // `now` moved on by the time each record is acted on: cut-offs are taken then
    const started = Date.now()
    const at = (ago: number) => new Date(now + (Date.now() - started) - ago)
    for (const video of await readVideos(container)) {
      const age = now - new Date(video.created_at).getTime()
      if (!video.product?.id && age > DAY_MS) {
        await service.softDeleteMediaVideos([video.id])
        result.removed += 1
        continue
      }
      const source = video.source_file_id
      if (!source) {
        continue
      }
      const sourced = { id: video.id, source_file_id: source }
      // A ready clip's source the job could not remove (storage refused): it goes now
      const gone =
        video.status === "ready"
          ? await letGoOfSource(container, sourced, () =>
              service.releaseReadySource(video.id, source, at(READY_SOURCE_GRACE_MS))
            )
          : video.status === "failed" &&
            (await letGoOfSource(container, sourced, () =>
              service.releaseFailedSource(video.id, source, at(FAILED_SOURCE_KEPT_MS))
            ))
      if (gone) {
        result.sources_removed += 1
      }
    }
    // Removed records (just now, or a refused removal before) whose files are still named
    for (const left of await service.videosWithFilesLeft()) {
      const ids = videoFileIds(left)
      if (await removeFiles(container, ids)) {
        await service.forgetVideoFiles(left.id, ids)
        result.files_removed += 1
      }
    }
    if (result.removed + result.files_removed + result.sources_removed > 0) {
      forgetUsage("storage_mb")
    }
    return new StepResponse(result)
  }
)
