import { MedusaService } from "@medusajs/framework/utils"
import { StorefrontLayout } from "./models/storefront-layout"
import { StorefrontLayoutRevision } from "./models/storefront-layout-revision"

/** Revisions kept; older ones are removed as new ones come (adr/0049). */
export const KEPT_REVISIONS = 20

/** The storefront's design (adr/0049): its draft, what is live, and earlier publications. */
class StorefrontLayoutModuleService extends MedusaService({
  StorefrontLayout,
  StorefrontLayoutRevision,
}) {}

export default StorefrontLayoutModuleService
