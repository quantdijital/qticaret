import type { InferTypeOf } from "@medusajs/framework/types"
import { MedusaService } from "@medusajs/framework/utils"
import { ContentEntry } from "./models/content-entry"

export type ContentEntryRecord = InferTypeOf<typeof ContentEntry>
export type ContentKind = ContentEntryRecord["kind"]

/**
 * Content pages and blog posts (F3.16). The rules (a checked document, a
 * slug handle, the shop's own images, the page's path) live in the
 * workflows that write here.
 */
class ContentModuleService extends MedusaService({ ContentEntry }) {}

export default ContentModuleService
