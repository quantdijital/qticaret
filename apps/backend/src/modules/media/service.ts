import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { MediaAsset } from "./models/media-asset"
import { MediaVideo } from "./models/media-video"
import * as queue from "./video-queue"
import type { ClaimedVideo, FailedTry, ReadyVideo, VideoFiles } from "./video-queue"
import * as retry from "./video-retry"
import * as sources from "./video-sources"
import type { RetriedVideo } from "./video-retry"

export type MediaAssetRecord = InferTypeOf<typeof MediaAsset>
export type MediaVideoRecord = InferTypeOf<typeof MediaVideo>
export type { ClaimedVideo, FailedTry, ReadyVideo, VideoFiles } from "./video-queue"
export type { RetriedVideo } from "./video-retry"

const managerOf = (sharedContext: Context): EntityManager => {
  const manager = sharedContext.manager as EntityManager | undefined
  if (!manager) {
    throw new Error("media: the video queue is moved with a manager")
  }
  return manager
}

const MediaServiceBase = MedusaService({ MediaAsset, MediaVideo })
type Generated = InstanceType<typeof MediaServiceBase>

/**
 * Product images (F3.3) and videos (adr/0069). The rules (whose file it
 * is, when the versions are remade, which files go with an image or a
 * video) live in the workflows that write here.
 */
class MediaModuleService extends MediaServiceBase {
  // Medusa's types pluralize "Video" as "Videoes"; the methods it makes at
  // runtime are named with its `pluralize`, "Videos". Typed as generated
  declare listMediaVideos: Generated["listMediaVideoes"]
  declare createMediaVideos: Generated["createMediaVideoes"]
  declare updateMediaVideos: Generated["updateMediaVideoes"]
  declare deleteMediaVideos: Generated["deleteMediaVideoes"]
  declare softDeleteMediaVideos: Generated["softDeleteMediaVideoes"]
  declare restoreMediaVideos: Generated["restoreMediaVideoes"]

  /**
   * Removed videos whose files storage has not taken yet (adr/0069 §11):
   * the nightly sweep tries them again. Read here, beside soft deleted
   * rows, with the columns named.
   */
  @InjectManager()
  async videosWithFilesLeft(
    limit = 500,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<
    {
      id: string
      source_file_id: string | null
      output_file_ids: string[] | null
      poster_file_ids: string[] | null
    }[]
  > {
    const manager = sharedContext.manager as EntityManager | undefined
    if (!manager) {
      throw new Error("media: removed videos are read with a manager")
    }
    return await manager.execute(
      `SELECT id, source_file_id, output_file_ids, poster_file_ids FROM media_video
       WHERE deleted_at IS NOT NULL
         AND (source_file_id IS NOT NULL OR output_file_ids IS NOT NULL OR poster_file_ids IS NOT NULL)
       ORDER BY id LIMIT ?`,
      [limit]
    )
  }

  /**
   * A removed video's files that storage took: its record no longer names
   * those (only those; review M2), nor counts bytes once it names none.
   */
  @InjectManager()
  async forgetVideoFiles(
    id: string,
    removed: readonly string[],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<void> {
    await queue.forgetVideoFiles(managerOf(sharedContext), id, removed)
  }

  /** The files a video names now, removed or not. */
  @InjectManager()
  async videoFiles(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<VideoFiles | null> {
    return await queue.videoFiles(managerOf(sharedContext), id)
  }

  /** The transcoding job takes the oldest waiting clip (adr/0069 §4; `video-queue.ts`). */
  @InjectManager()
  async claimNextVideo(
    exclude: readonly string[] = [],
    @MedusaContext() sharedContext: Context = {}
  ): Promise<ClaimedVideo | null> {
    return await queue.claimNextVideo(managerOf(sharedContext), exclude)
  }

  /** The job's heartbeat; false once the video is no longer this claim's (`attempts` fences it). */
  @InjectManager()
  async beatVideo(
    id: string,
    attempts: number,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await queue.beatVideo(managerOf(sharedContext), id, attempts)
  }

  /** Silent `processing` videos back to the queue, or failed past their tries. */
  @InjectManager()
  async requeueStaleVideos(
    before: Date,
    maxAttempts: number,
    failedCode: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<{ id: string; status: string }[]> {
    return await queue.requeueStaleVideos(managerOf(sharedContext), before, maxAttempts, failedCode)
  }

  @InjectManager()
  async markVideoReady(
    id: string,
    attempts: number,
    ready: ReadyVideo,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await queue.markVideoReady(managerOf(sharedContext), id, attempts, ready)
  }

  /** `ready` taken back; true when it changed the row (only then may the outputs go). */
  @InjectManager()
  async unmarkVideoReady(
    id: string,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await queue.unmarkVideoReady(managerOf(sharedContext), id)
  }

  @InjectManager()
  async markVideoTried(
    id: string,
    claimed: number,
    next: FailedTry,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await queue.markVideoTried(managerOf(sharedContext), id, claimed, next)
  }

  @InjectManager()
  async forgetVideoSource(id: string, @MedusaContext() sharedContext: Context = {}): Promise<void> {
    await queue.forgetVideoSource(managerOf(sharedContext), id)
  }

  /** "Yeniden dene": a clip failed by the infrastructure back in the queue (`video-retry.ts`). */
  @InjectManager()
  async retryVideo(
    id: string,
    failedCode: string,
    keptSince: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<RetriedVideo | null> {
    return await retry.retryVideo(managerOf(sharedContext), id, failedCode, keptSince)
  }

  /** The sweep's release of a week-old failed source, checked again (`video-sources.ts`). */
  @InjectManager()
  async releaseFailedSource(
    id: string,
    sourceFileId: string,
    failedBefore: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await sources.releaseFailedSource(
      managerOf(sharedContext),
      id,
      sourceFileId,
      failedBefore
    )
  }

  /** The sweep's release of a ready clip's left-over source, checked again. */
  @InjectManager()
  async releaseReadySource(
    id: string,
    sourceFileId: string,
    readyBefore: Date,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await sources.releaseReadySource(managerOf(sharedContext), id, sourceFileId, readyBefore)
  }

  /** The retry undone while no job has taken the clip since. */
  @InjectManager()
  async unretryVideo(
    id: string,
    failedCode: string,
    retried: RetriedVideo,
    @MedusaContext() sharedContext: Context = {}
  ): Promise<boolean> {
    return await retry.unretryVideo(managerOf(sharedContext), id, failedCode, retried)
  }

  /**
   * Bytes held in storage (adr/0061 §5.4, C13's usage report; adr/0069 §3):
   * the images' stored masters, and every file a video holds (its source
   * until it is processed, then its outputs and poster). The images' served
   * versions (WebP/AVIF, share crops) are not sized here; the measure of
   * the live file store comes with F16 (adr/0061 §8).
   */
  @InjectManager()
  async storedBytes(@MedusaContext() sharedContext: Context = {}): Promise<number> {
    const manager = sharedContext.manager as EntityManager | undefined
    if (!manager) {
      throw new Error("media: the stored bytes are read with a manager")
    }
    const [row] = await manager.execute<{ bytes: string | number | null }[]>(
      `SELECT
         (SELECT COALESCE(SUM(size), 0) FROM media_asset
          WHERE deleted_at IS NULL AND file_id IS NOT NULL)
       + (SELECT COALESCE(SUM(stored_bytes), 0) FROM media_video
          WHERE deleted_at IS NULL) AS bytes`
    )
    return Number(row?.bytes ?? 0)
  }
}

export default MediaModuleService
