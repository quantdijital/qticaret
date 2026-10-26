import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { CONTENT_MODULE } from "../../../modules/content"
import type ContentModuleService from "../../../modules/content/service"

/** Soft-deletes a content entry, so the compensation can bring it back. */
export const deleteContentStep = createStep(
  "content-remove-entry",
  async (id: string, { container }) => {
    const service = container.resolve<ContentModuleService>(CONTENT_MODULE)
    const [entry] = await service.listContentEntries({ id }, { take: 1, select: ["id", "kind"] })
    if (!entry) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "content.unknown")
    }
    await service.softDeleteContentEntries([id])
    return new StepResponse({ id, kind: entry.kind }, id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<ContentModuleService>(CONTENT_MODULE).restoreContentEntries([id])
    }
  }
)
