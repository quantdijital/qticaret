import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { SeoMeta } from "./models/seo-meta"

export type SeoMetaRecord = InferTypeOf<typeof SeoMeta>

/**
 * Pages' SEO fields (adr/0015). The rules (clean text, length caps, own
 * paths and files, duplicate warnings) live in the workflow that writes here.
 */
class SeoMetaModuleService extends MedusaService({ SeoMeta }) {}

export default SeoMetaModuleService
