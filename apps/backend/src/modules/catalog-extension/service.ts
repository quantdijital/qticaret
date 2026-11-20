import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { CategoryExtension } from "./models/category-extension"
import { CategoryImage } from "./models/category-image"
import { CategoryRestriction } from "./models/category-restriction"
import { CollectionExtension } from "./models/collection-extension"
import { ProductExtension } from "./models/product-extension"
import { VariantExtension } from "./models/variant-extension"

export type ProductExtensionRecord = InferTypeOf<typeof ProductExtension>
export type VariantExtensionRecord = InferTypeOf<typeof VariantExtension>
export type CategoryImageRecord = InferTypeOf<typeof CategoryImage>
export type CollectionExtensionRecord = InferTypeOf<typeof CollectionExtension>
export type CategoryExtensionRecord = InferTypeOf<typeof CategoryExtension>

/**
 * Catalog fields Medusa's product, variant, category and collection lack
 * (F3.1, F13.4; a category's picture, adr/0046 Ek 2026-11-04; a
 * collection's text, picture and visibility; a category's text as a
 * document, adr/0075). The rules (primary category
 * among the product's categories, no successor loop) live in the workflow
 * that writes here.
 */
class CatalogExtensionModuleService extends MedusaService({
  ProductExtension,
  VariantExtension,
  CategoryRestriction,
  CategoryImage,
  CategoryExtension,
  CollectionExtension,
}) {}

export default CatalogExtensionModuleService
