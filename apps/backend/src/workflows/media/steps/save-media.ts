import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"

export interface SaveMediaInput {
  id: string
  /** Its alt text (docs/13 §8); null clears it, absent leaves it. */
  alt?: string | null
  /** The name the library shows; its address stays as it is. */
  filename?: string
}

/**
 * An image's alt text and the name the library shows. Returns what was
 * saved and its product, if it has one (for its assessment).
 */
export const saveMediaStep = createStep(
  "media-save-alt",
  async (input: SaveMediaInput, { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const [asset] = await media.listMediaAssets({ id: input.id }, { take: 1 })
    if (!asset) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.unknown")
    }
    const alt = input.alt === undefined ? asset.alt : input.alt
    const filename = input.filename ?? asset.filename
    await media.updateMediaAssets({ id: asset.id, alt, filename })
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "media_asset",
      fields: ["product.id"],
      filters: { id: asset.id },
    })
    const productId = (data[0] as { product?: { id: string } | null } | undefined)?.product?.id
    return new StepResponse(
      {
        id: asset.id,
        alt,
        filename,
        alt_changed: alt !== asset.alt,
        product_id: productId ?? null,
      },
      { id: asset.id, alt: asset.alt, filename: asset.filename }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).updateMediaAssets(undo)
    }
  }
)
