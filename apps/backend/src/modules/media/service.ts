import type { EntityManager } from "@medusajs/framework/mikro-orm/knex"
import type { Context, InferTypeOf } from "@medusajs/framework/types"
import { InjectManager, MedusaContext, MedusaService } from "@medusajs/framework/utils"
import { MediaAsset } from "./models/media-asset"

export type MediaAssetRecord = InferTypeOf<typeof MediaAsset>

/**
 * Product images (F3.3). The rules (whose file it is, when the versions are
 * remade, which files go with an image) live in the workflows that write here.
 */
class MediaModuleService extends MedusaService({ MediaAsset }) {
  /**
   * Bytes of the stored masters (adr/0061 §5.4, C13's usage report): one
   * sum over the rows that hold a file. The served versions (WebP/AVIF,
   * share crops) are not sized here; the measure of the live file store
   * comes with F16 (adr/0061 §8).
   */
  @InjectManager()
  async storedBytes(@MedusaContext() sharedContext: Context = {}): Promise<number> {
    const manager = sharedContext.manager as EntityManager | undefined
    if (!manager) {
      throw new Error("media: the stored bytes are read with a manager")
    }
    const [row] = await manager.execute<{ bytes: string | number | null }[]>(
      `SELECT COALESCE(SUM(size), 0) AS bytes FROM media_asset
       WHERE deleted_at IS NULL AND file_id IS NOT NULL`
    )
    return Number(row?.bytes ?? 0)
  }
}

export default MediaModuleService
