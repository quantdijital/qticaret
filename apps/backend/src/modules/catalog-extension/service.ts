import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { CategoryRestriction } from "./models/category-restriction"
import { ProductExtension } from "./models/product-extension"
import { VariantExtension } from "./models/variant-extension"

export type ProductExtensionRecord = InferTypeOf<typeof ProductExtension>
export type VariantExtensionRecord = InferTypeOf<typeof VariantExtension>

/**
 * Catalog fields Medusa's product, variant and category lack (F3.1, F13.4). The rules
 * (primary category among the product's categories, no successor loop)
 * live in the workflow that writes here.
 */
class CatalogExtensionModuleService extends MedusaService({
  ProductExtension,
  VariantExtension,
  CategoryRestriction,
}) {}

export default CatalogExtensionModuleService
