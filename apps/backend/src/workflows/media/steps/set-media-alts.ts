import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { MEDIA_MODULE } from "../../../modules/media"
import type MediaModuleService from "../../../modules/media/service"

export interface MediaAlt {
  id: string
  alt: string | null
}

/** Several images' alt texts at once (bulk edit, F3.10); undone to what they had. */
export const setMediaAltsStep = createStep(
  "media-save-alts",
  async (input: { alts: MediaAlt[] }, { container }) => {
    const media = container.resolve<MediaModuleService>(MEDIA_MODULE)
    const ids = input.alts.map((each) => each.id)
    const before = await media.listMediaAssets({ id: ids }, { select: ["id", "alt"] })
    if (before.length !== new Set(ids).size) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "media.unknown")
    }
    await media.updateMediaAssets(input.alts.map(({ id, alt }) => ({ id, alt })))
    return new StepResponse(
      input.alts,
      before.map(({ id, alt }) => ({ id, alt: alt ?? null }))
    )
  },
  async (undo, { container }) => {
    if (undo?.length) {
      await container.resolve<MediaModuleService>(MEDIA_MODULE).updateMediaAssets(undo)
    }
  }
)
