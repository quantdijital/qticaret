import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import ProductAttributesModule from "../modules/product-attributes"

/** A product follows one attribute template; a template serves many products (adr/0013). */
export default defineLink(
  { linkable: ProductModule.linkable["product"], isList: true },
  ProductAttributesModule.linkable.attributeTemplate
)
