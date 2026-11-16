import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import MediaModule from "../modules/media"

/**
 * A product's videos (adr/0069 §1): many per product (at most two, the
 * server counts), one product per video. Deleting the product removes the
 * link; the nightly sweep removes the videos left without a product.
 */
// Core module linkables are typed `any` by Medusa; the linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["product"], {
  linkable: MediaModule.linkable.mediaVideo,
  isList: true,
})
