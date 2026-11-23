import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import ProductAttributesModule from "../modules/product-attributes"

/**
 * The add-on templates a product follows directly (adr/0052 Ek
 * 2026-11-23): many per product, many products per template. Live: the
 * product reads the template's add-ons as they are now. Deleting the
 * template dismisses its links first.
 */
export default defineLink(
  { linkable: ProductModule.linkable["product"], isList: true },
  { linkable: ProductAttributesModule.linkable.addonTemplate, isList: true }
)
