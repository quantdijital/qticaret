import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetContentTerms,
  AdminPostContentTerm,
  AdminUpdateContentTerm,
} from "../admin/content/terms/validators"
import { AdminGetContent, AdminPostContent, AdminUpdateContent } from "../admin/content/validators"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminGetLandings,
  AdminPostLanding,
  AdminUpdateLanding,
} from "../admin/landings/validators"
import { StoreGetContent, StoreGetContentTerms } from "../store/content/validators"
import { StoreGetLandingProducts } from "../store/landings/validators"
import { StoreGetListingProducts } from "../store/listings/validators"
import { rateLimit } from "./rate-limit"

// An entry's own route: `/admin/content/terms` is the blog terms', not an entry called "terms"
const CONTENT_ENTRY = /^\/admin\/content\/(?!terms$)[^/]+$/

/**
 * Content pages, blog posts and facet landing pages (F3.16): the admin's
 * lists and saves, the storefront's lists and pages, and its frame (F18). Integration keys may write content (an
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
    matcher: CONTENT_ENTRY,
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "1mb" },
    middlewares: [validateAndTransformBody(AdminUpdateContent)],
  },
  // A blog's categories and tags (adr/0019 ek 2026-11-03)
  {
    matcher: "/admin/content/terms",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetContentTerms, {})],
  },
  {
    matcher: "/admin/content/terms",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostContentTerm)],
  },
  {
    matcher: "/admin/content/terms/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminUpdateContentTerm)],
  },
  {
    matcher: "/store/content",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetContent, {})],
  },
  {
    matcher: "/store/content/terms",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetContentTerms, {})],
  },
  // The storefront's frame: announcement bar, header links, footer (F18 D3)
  {
    matcher: "/store/storefront",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
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
  // A draft's preview link: no body at all (CLAUDE.md: every route has its schema)
  {
    matcher: "/admin/content/:id/preview",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(z.object({}).strict())],
  },
  // A draft's signed preview (F18)
  {
    matcher: "/store/content/preview/:token",
    methods: ["GET" as const],
    middlewares: [rateLimit(() => RATE_LIMIT_PROFILES.content_preview)],
  },
  // A listing's filtered, sorted page and its filters (F18 D4)
  {
    matcher: "/store/listings/products",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.listing),
      validateAndTransformQuery(StoreGetListingProducts, {}),
    ],
  },
]
