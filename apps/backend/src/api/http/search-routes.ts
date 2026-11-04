import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetSearchSynonyms, AdminPostSearchSynonym } from "../admin/search/synonyms/validators"

/**
 * Site search's settings (adr/0056): the shop's synonym groups. A catalogue
 * setting: the owner and admins write it, the others read it (staff roles).
 * The index's own state is the operator's (`search:status`), not the shop's.
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
]
