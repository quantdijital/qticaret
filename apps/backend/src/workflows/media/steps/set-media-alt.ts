import { ContainerRegistrationKeys, MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"

/** An image's alt text (docs/13 §8); null clears it. Returns its product, if it has one. */
export const setMediaAltStep = createStep(
  "media-save-alt",
  async (input: { id: string; alt: string | null }, { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const [asset] = await media.listMediaAssets({ id: input.id }, { take: 1 })
    if (!asset) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.unknown")
    }
    await media.updateMediaAssets({ id: asset.id, alt: input.alt })
    const { data } = await container.resolve(ContainerRegistrationKeys.QUERY).graph({
      entity: "media_asset",
      fields: ["product.id"],
      filters: { id: asset.id },
    })
    const productId = (data[0] as { product?: { id: string } | null } | undefined)?.product?.id
    return new StepResponse(
      { id: asset.id, alt: input.alt, product_id: productId ?? null },
      { id: asset.id, alt: asset.alt }
    )
  },
  async (undo, { container }) => {
    if (undo) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).updateMediaAssets(undo)
    }
  }
)
