import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import ProductAttributesModule from "../modules/product-attributes"

/**
 * A product's attribute values (adr/0013); removing the product's links
 * removes its values. One value per product and definition is kept by the
 * locked upsert workflow.
 */
// Core module linkables are typed `any` by Medusa; the product linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["product"], {
  linkable: ProductAttributesModule.linkable.attributeValue,
  isList: true,
  deleteCascade: true,
})
