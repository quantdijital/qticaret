import { defineLink } from "@medusajs/framework/utils"
import ContentModule from "../modules/content"
import SeoMetaModule from "../modules/seo-meta"

/** A blog category's or tag's own SEO fields (adr/0015); they go with it. */
export default defineLink(ContentModule.linkable.contentTerm, {
  linkable: SeoMetaModule.linkable.seoMeta,
  deleteCascade: true,
})
