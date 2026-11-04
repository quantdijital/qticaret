import type { MedusaContainer } from "@medusajs/framework/types"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaAssetRecord } from "../../../modules/media/service"
import { removeFiles } from "../files"
import { mediaUses } from "../usage"

// Still unused: never attached, not kept in the library, and shown nowhere (a
// product, a brand's logo, a page, the shop's logos; docs/06 Ortam kütüphanesi).
// Read again here: a content page (F3.16) may have taken it since the sweep's
// list, a picker may have chosen it for a brand that does not mark it
async function isAbandoned(container: MedusaContainer, asset: MediaAssetRecord): Promise<boolean> {
  const [fresh] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ id: asset.id }, { select: ["id", "attached_at", "in_library"], take: 1 })
  if (!fresh || fresh.attached_at || fresh.in_library) {
    return false
  }
  return (await mediaUses(container, asset)).length === 0
}

/**
 * Removes uploads no product ever took (F3.3): checked again here, their
 * files first and the record only once storage took them, so a refusal is
 * tried again the next night. A master another record shares stays.
 */
export const removeAbandonedMediaStep = createStep(
  "media-remove-abandoned",
  async (ids: string[], { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    let removed = 0
    for (const asset of ids.length ? await media.listMediaAssets({ id: ids }) : []) {
      if (!(await isAbandoned(container, asset))) {
        continue
      }
      const [sharing] = asset.file_id
        ? await media.listMediaAssets(
            { file_id: asset.file_id, id: { $ne: asset.id } },
            { select: ["id"], take: 1 }
          )
        : []
      const files = [
        ...(asset.file_id && !sharing ? [asset.file_id] : []),
        ...(asset.derivative_file_ids ?? []),
      ]
      if (await removeFiles(container, files)) {
        await media.deleteMediaAssets([asset.id])
        removed += 1
      }
    }
    return new StepResponse(removed)
  }
)
