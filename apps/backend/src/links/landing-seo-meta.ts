import { defineLink } from "@medusajs/framework/utils"
import ContentModule from "../modules/content"
import SeoMetaModule from "../modules/seo-meta"

/** A facet landing page's own SEO fields (adr/0015); they go with it. */
export default defineLink(ContentModule.linkable.landingPage, {
  linkable: SeoMetaModule.linkable.seoMeta,
  deleteCascade: true,
})
