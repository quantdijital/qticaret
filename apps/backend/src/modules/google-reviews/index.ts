import { Module } from "@medusajs/framework/utils"
import GoogleReviewsModuleService from "./service"

/** The shop's Google reviews from its Business Profile location, for the storefront (adr/0058). */
export const GOOGLE_REVIEWS_MODULE = "google_reviews"

export default Module(GOOGLE_REVIEWS_MODULE, { service: GoogleReviewsModuleService })
