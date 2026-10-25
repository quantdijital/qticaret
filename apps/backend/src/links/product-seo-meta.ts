import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import SeoMetaModule from "../modules/seo-meta"

/** A product's own SEO fields (adr/0015); they go with the product. */
// Core module linkables are typed `any` by Medusa; the linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["product"], {
  linkable: SeoMetaModule.linkable.seoMeta,
  deleteCascade: true,
})
