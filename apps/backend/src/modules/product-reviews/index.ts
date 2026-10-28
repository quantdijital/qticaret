import { Module } from "@medusajs/framework/utils"
import ProductReviewsModuleService from "./service"

/** Purchasers' product reviews and their summed ratings (F10.6, adr/0037 §4). */
export const PRODUCT_REVIEWS_MODULE = "product_reviews"

export default Module(PRODUCT_REVIEWS_MODULE, { service: ProductReviewsModuleService })
