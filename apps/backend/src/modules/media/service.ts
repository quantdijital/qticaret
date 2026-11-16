import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { MediaAsset } from "./models/media-asset"
import { MediaVideo } from "./models/media-video"

export type MediaAssetRecord = InferTypeOf<typeof MediaAsset>
export type MediaVideoRecord = InferTypeOf<typeof MediaVideo>

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
