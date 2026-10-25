import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { ProductExtension } from "./models/product-extension"
import { VariantExtension } from "./models/variant-extension"

export type ProductExtensionRecord = InferTypeOf<typeof ProductExtension>
export type VariantExtensionRecord = InferTypeOf<typeof VariantExtension>

/**
 * Catalog fields Medusa's product and variant lack (F3.1). The rules
 * (primary category among the product's categories, no successor loop)
 * live in the workflow that writes here.
 */
class CatalogExtensionModuleService extends MedusaService({
  ProductExtension,
  VariantExtension,
}) {}

export default CatalogExtensionModuleService
