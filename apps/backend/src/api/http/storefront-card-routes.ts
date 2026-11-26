import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminPostCategoryDescription } from "../admin/category-descriptions/validators"
import { AdminPostCategoryImage } from "../admin/category-images/validators"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import { StoreGetCardFacts } from "../store/card-facts/validators"
import { StoreGetLinkedProducts } from "../store/linked-products/validators"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"

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
  // adr/0075: a category's text as a document, written by staff, shown by anyone
  {
    matcher: "/admin/category-descriptions/:category_id",
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  },
  {
    matcher: "/admin/category-descriptions/:category_id",
    methods: ["POST" as const],
    // A long document is past Express's 100 kB default; its own bounds stay (adr/0055)
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostCategoryDescription)],
  },
  {
    matcher: "/store/category-descriptions/:id",
    methods: ["GET" as const],
    middlewares: [noQuery],
  },
  {
    // Every shown category's product count (adr/0049 Ek 2026-11-14 §10 karar 7b)
    matcher: "/store/category-counts",
    methods: ["GET" as const],
    middlewares: [noQuery],
  },
  {
    matcher: "/store/card-facts",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.card_facts),
      validateAndTransformQuery(StoreGetCardFacts, {}),
    ],
  },
  {
    // S3: a product page's linked products, a cart's cross-sells
    matcher: "/store/linked-products",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.linked_products),
      validateAndTransformQuery(StoreGetLinkedProducts, {}),
    ],
  },
]
