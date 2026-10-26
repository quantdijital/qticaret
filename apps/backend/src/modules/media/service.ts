import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { MediaAsset } from "./models/media-asset"

export type MediaAssetRecord = InferTypeOf<typeof MediaAsset>

/**
 * Product images (F3.3). The rules (whose file it is, when the versions are
 * remade, which files go with an image) live in the workflows that write here.
 */
class MediaModuleService extends MedusaService({ MediaAsset }) {}

export default MediaModuleService
