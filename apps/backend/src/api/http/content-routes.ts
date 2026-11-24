import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { z } from "@medusajs/framework/zod"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import {
  AdminGetContentAuthors,
  AdminPostContentAuthor,
  AdminUpdateContentAuthor,
} from "../admin/content/authors/validators"
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
import { StoreGetListingProducts, StoreGetListingSuggest } from "../store/listings/validators"
import { datedListingProfile } from "./dated-listing-limit"
import { rateLimit } from "./rate-limit"

// An entry's own route: `/admin/content/terms` and `/admin/content/authors` are the blog's
// terms' and authors', not entries called so
const CONTENT_ENTRY = /^\/admin\/content\/(?!terms$|authors$)[^/]+$/

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
  // A blog's authors (adr/0060)
  {
    matcher: "/admin/content/authors",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetContentAuthors, {})],
  },
  {
    matcher: "/admin/content/authors",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostContentAuthor)],
  },
  {
    matcher: "/admin/content/authors/:id",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminUpdateContentAuthor)],
  },
  {
    matcher: "/store/content",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetContent, {})],
  },
  {
    matcher: "/store/content/authors/:id",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/store/content/terms",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetContentTerms, {})],
  },
  // A product's description document, rendered (adr/0055)
  {
    matcher: "/store/products/:id/description",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
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
      rateLimit(datedListingProfile),
      validateAndTransformQuery(StoreGetListingProducts, {}),
    ],
  },
  // The header's live search: a few hits as the shopper types (never counted for the report)
  {
    matcher: "/store/listings/suggest",
    methods: ["GET" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.search_suggest),
      validateAndTransformQuery(StoreGetListingSuggest, {}),
    ],
  },
]
