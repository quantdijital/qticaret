import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { AI_STOREFRONT_SEARCH } from "../../modules/platform-settings/features"
import { AdminGetSearchSynonyms, AdminPostSearchSynonym } from "../admin/search/synonyms/validators"
import { StorePostSearchInterpret } from "../store/search/interpret/validators"
import { rateLimit } from "./rate-limit"
import { requireFeature } from "./require-feature"

/**
 * Site search's settings (adr/0056): the shop's synonym groups. A catalogue
 * setting: the owner and admins write it, the others read it (staff roles).
 * The index's own state is the operator's (`search:status`), not the shop's.
 *
 * The storefront's "search in your own words" (adr/0077 §7): no such route
 * while `ai.storefront_search` is off; each address may ask five times a
 * minute and thirty times a day, before the body is read.
 */
export const SEARCH_ROUTES = [
  {
    matcher: "/admin/search/synonyms",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetSearchSynonyms, {})],
  },
  {
    matcher: "/admin/search/synonyms",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostSearchSynonym)],
  },
  {
    matcher: "/admin/search/synonyms/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostSearchSynonym)],
  },
  {
    matcher: "/store/search/interpret",
    methods: ["POST" as const],
    middlewares: [
      requireFeature(AI_STOREFRONT_SEARCH),
      rateLimit(() => RATE_LIMIT_PROFILES.ai_store_search),
      rateLimit(() => RATE_LIMIT_PROFILES.ai_store_search_daily),
      validateAndTransformBody(StorePostSearchInterpret),
    ],
  },
]
