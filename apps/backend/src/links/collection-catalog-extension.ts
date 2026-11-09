import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import CatalogExtensionModule from "../modules/catalog-extension"

/** A collection's text, picture and visibility; they go with the collection. */
// Core module linkables are typed `any` by Medusa; the linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["productCollection"], {
  linkable: CatalogExtensionModule.linkable.collectionExtension,
  deleteCascade: true,
})
