import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminPostCategoryImage } from "../admin/category-images/validators"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { StoreGetCardFacts } from "../store/card-facts/validators"
import { requireUserActor } from "./actor"

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

/**
 * What the storefront's cards show beyond Medusa's answers (adr/0046 Ek
 * 2026-11-04): a category's picture (set by staff, read by anyone) and a
 * product card's stock bucket and quick-add variant.
 */
export const STOREFRONT_CARD_ROUTES = [
  {
    matcher: "/admin/category-images",
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  },
  {
    matcher: "/admin/category-images/:category_id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostCategoryImage)],
  },
  {
    matcher: "/store/category-images",
    methods: ["GET" as const],
    middlewares: [noQuery],
  },
  {
    matcher: "/store/card-facts",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetCardFacts, {})],
  },
]
