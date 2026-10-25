import { ContainerRegistrationKeys, MedusaError, Modules } from "@medusajs/framework/utils"
import { StepResponse, createStep } from "@medusajs/framework/workflows-sdk"
import { ValidationError } from "../../../lib/errors"
import { BRANDS_MODULE } from "../../../modules/brands"
import type BrandsModuleService from "../../../modules/brands/service"

export interface SetProductBrandInput {
  product_id: string
  /** null takes the brand off. */
  brand_id: string | null
}

type LinkDefinition = Record<string, Record<string, string>>

const link = (productId: string, brandId: string): LinkDefinition => ({
  [Modules.PRODUCT]: { product_id: productId },
  [BRANDS_MODULE]: { brand_id: brandId },
})

/** The links to drop and to make so the product has the asked brand, or none. */
export const planProductBrandStep = createStep(
  "brands-plan-product-brand",
  async (input: SetProductBrandInput, { container }) => {
    const query = container.resolve(ContainerRegistrationKeys.QUERY)
    const { data } = await query.graph({
      entity: "product",
      fields: ["id", "brand.id"],
      filters: { id: input.product_id },
    })
    const product = data[0] as { id: string; brand?: { id: string } | null } | undefined
    if (!product) {
      throw new MedusaError(MedusaError.Types.NOT_FOUND, "catalog.product_unknown")
    }
    if (input.brand_id) {
      const brands = await container
        .resolve<BrandsModuleService>(BRANDS_MODULE)
        .listBrands({ id: input.brand_id }, { take: 1, select: ["id"] })
      if (brands.length === 0) {
        throw new ValidationError("brands.unknown", { field: "brand_id" })
      }
    }
    const current = product.brand?.id ?? null
    const same = current === input.brand_id
    return new StepResponse({
      dismiss: !same && current ? [link(input.product_id, current)] : [],
      create: !same && input.brand_id ? [link(input.product_id, input.brand_id)] : [],
    })
  }
)
