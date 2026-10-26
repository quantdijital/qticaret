import { defineLink } from "@medusajs/framework/utils"
import ContentModule from "../modules/content"
import SeoMetaModule from "../modules/seo-meta"

/** A content page's or blog post's own SEO fields (adr/0015); they go with it. */
export default defineLink(ContentModule.linkable.contentEntry, {
  linkable: SeoMetaModule.linkable.seoMeta,
  deleteCascade: true,
})
