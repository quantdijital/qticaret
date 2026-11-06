import { defineLink } from "@medusajs/framework/utils"
import ContentModule from "../modules/content"
import SeoMetaModule from "../modules/seo-meta"

/** A blog author's page's own SEO fields (adr/0015, adr/0060); they go with the author. */
export default defineLink(ContentModule.linkable.contentAuthor, {
  linkable: SeoMetaModule.linkable.seoMeta,
  deleteCascade: true,
})
