import type { MedusaContainer } from "@medusajs/framework/types"
import { ContainerRegistrationKeys } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"
import type { MediaAssetRecord } from "../../../modules/media/service"
import { removeFiles } from "../files"

// Still unused: never attached, linked to nothing, and no product image has the URL.
// Read again here: a content page (F3.16) may have taken it since the sweep's list
async function isAbandoned(container: MedusaContainer, asset: MediaAssetRecord): Promise<boolean> {
  const [fresh] = await container
    .resolve<MediaModuleService>(MEDIA_MODULE)
    .listMediaAssets({ id: asset.id }, { select: ["id", "attached_at"], take: 1 })
  if (!fresh || fresh.attached_at) {
    return false
  }
  const query = container.resolve(ContainerRegistrationKeys.QUERY)
  const [{ data: linked }, { data: images }] = await Promise.all([
    query.graph({ entity: "media_asset", fields: ["product.id"], filters: { id: asset.id } }),
    query.graph({
      entity: "product_image",
      fields: ["id"],
      filters: { url: asset.url },
      pagination: { take: 1 },
    }),
  ])
  const product = (linked[0] as { product?: { id: string } | null } | undefined)?.product
  return !product && images.length === 0
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
