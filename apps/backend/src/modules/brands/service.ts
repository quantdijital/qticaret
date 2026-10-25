import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { Brand } from "./models/brand"

export type BrandRecord = InferTypeOf<typeof Brand>

/**
 * Brands (F3.11). The rules (one name per shop, slug handles, own logo
 * files, the page's path) live in the workflows that write here.
 */
class BrandsModuleService extends MedusaService({ Brand }) {}

export default BrandsModuleService
