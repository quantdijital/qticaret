import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"

/** Soft-deletes a brand, so the compensation can bring it back. */
export const deleteBrandStep = createStep(
  "brands-delete-brand",
  async (id: string, { container }) => {
    const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
    const [brand] = await service.listBrands({ id }, { take: 1, select: ["id"] })
    if (!brand) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "brands.unknown")
    }
    await service.softDeleteBrands([id])
    return new StepResponse({ id }, id)
  },
  async (id, { container }) => {
    if (id) {
      await container.resolve<BrandsModuleService>(BRANDS_MODULE).restoreBrands([id])
    }
  }
)
