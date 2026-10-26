import ProductModule from "@medusajs/medusa/product"
import { defineLink } from "@medusajs/framework/utils"
import MediaModule from "../modules/media"

/**
 * A product's images as the media module keeps them (F3.3): many per
 * product, one product per image. Deleting the product removes the link;
 * the images' files go with the nightly sweep.
 */
// Core module linkables are typed `any` by Medusa; the linkable exists at runtime.
// eslint-disable-next-line @typescript-eslint/no-unsafe-argument
export default defineLink(ProductModule.linkable["product"], {
  linkable: MediaModule.linkable.mediaAsset,
  isList: true,
})
