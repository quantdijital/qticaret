import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"

/** Soft-deletes a landing page, so the compensation can bring it back. */
export const deleteLandingStep = createStep(
  "content-remove-landing",
  async (id: string, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const [landing] = await service.listLandingPages({ id }, { take: 1, select: ["id"] })
    if (!landing) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.landing_unknown")
    }
    await service.softDeleteLandingPages([id])
    return new StepResponse({ id }, id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<ContentModuleService>(CONTENT_MODULE).restoreLandingPages([id])
    }
  }
)
