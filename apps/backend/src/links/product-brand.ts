import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import BrandsModule from "../modules/brands"

/**
 * A product's brand (F3.11): one brand per product, many products per
 * brand. Deleting either removes the link only.
 */
export default defineLink(
  { linkable: ProductModule.linkable["product"], isList: true },
  BrandsModule.linkable.brand
)
