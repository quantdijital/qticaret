import { MedusaError } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"
import { brandFields } from "../rules"
import type { BrandFields, BrandInput } from "../rules"

export interface SaveBrandInput {
  /** The brand to change; none makes a new one. */
  id?: string | undefined
  values: BrandInput
}

type Undo = { created: string } | { id: string; previous: BrandFields }
type Saved = BrandFields & { id: string }

/** Checks and writes a brand; undone if a later step fails (its path, its cache). */
export const saveBrandStep = createStep(
  "brands-save-brand",
  async (input: SaveBrandInput, { container }) => {
    const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
    const current = input.id
      ? ((await service.listBrands({ id: input.id }, { take: 1 }))[0] ?? null)
      : null
    if (input.id && !current) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "brands.unknown")
    }
    const fields = await brandFields(container, input.values, current)
    if (!current) {
      const created = await service.createBrands(fields)
      const undo: Undo = { created: created.id }
      return new StepResponse<Saved, Undo>({ id: created.id, ...fields }, undo)
    }
    await service.updateBrands({ id: current.id, ...fields })
    const previous: BrandFields = {
      name: current.name,
      handle: current.handle,
      description: current.description,
      logo_file_id: current.logo_file_id,
      logo_url: current.logo_url,
      logo_width: current.logo_width,
      logo_height: current.logo_height,
      is_active: current.is_active,
    }
    const undo: Undo = { id: current.id, previous }
    return new StepResponse<Saved, Undo>({ id: current.id, ...fields }, undo)
  },
  async (undo, { container }) => {
    if (!undo) {
      return
    }
    const service = container.resolve<BrandsModuleService>(BRANDS_MODULE)
    if ("created" in undo) {
      await service.deleteBrands(undo.created)
    } else {
      await service.updateBrands({ id: undo.id, ...undo.previous })
    }
  }
)
