import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetContent, AdminPostContent, AdminUpdateContent } from "../admin/content/validators"
import {
  AdminGetLandings,
  AdminPostLanding,
  AdminUpdateLanding,
} from "../admin/landings/validators"
import { StoreGetContent } from "../store/content/validators"
import { StoreGetLandingProducts } from "../store/landings/validators"

/**
 * Content pages, blog posts and facet landing pages (F3.16): the admin's
 * lists and saves, the storefront's lists and pages. Integration keys may write content (an
 * import brings it, F14).
 */
export const CONTENT_ROUTES = [
  {
    matcher: "/admin/content",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetContent, {})],
  },
  // A long post's document is past Express's 100 kB default; the document's own bounds stay (adr/0019)
  {
    matcher: "/admin/content",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminPostContent)],
  },
  {
    matcher: "/admin/content/:id",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminUpdateContent)],
  },
  {
    matcher: "/store/content",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetContent, {})],
  },
  {
    matcher: "/admin/landings",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetLandings, {})],
  },
  {
    matcher: "/admin/landings",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminPostLanding)],
  },
  {
    matcher: "/admin/landings/:id",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminUpdateLanding)],
  },
  {
    matcher: "/store/landings/:id/products",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetLandingProducts, {})],
  },
]
