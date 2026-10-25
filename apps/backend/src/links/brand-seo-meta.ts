import { defineLink } from "@medusajs/framework/utils"
import BrandsModule from "../modules/brands"
import SeoMetaModule from "../modules/seo-meta"

/** A brand page's own SEO fields (adr/0015); they go with the brand. */
export default defineLink(BrandsModule.linkable.brand, {
  linkable: SeoMetaModule.linkable.seoMeta,
  deleteCascade: true,
})
