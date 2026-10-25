import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import CatalogExtensionModule from "../modules/catalog-extension"

/** A product's catalog fields (F3.1); they go with the product. */
// Core module linkables are typed `any` by Medusa; the linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["product"], {
  linkable: CatalogExtensionModule.linkable.productExtension,
  deleteCascade: true,
})
