import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import BookingModule from "../modules/booking"

/** A dated product's booking settings (adr/0076 §3); they go with the product. */
// Core module linkables are typed `any` by Medusa; the linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["product"], {
  linkable: BookingModule.linkable.bookable,
  deleteCascade: true,
})
