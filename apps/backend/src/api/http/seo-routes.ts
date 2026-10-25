import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { requireUserActor } from "./actor"
import { rateLimit } from "./rate-limit"
import { StoreGetSeoResolve, StorePostNotFound } from "../store/seo/validators"
import { AdminPutSeoMeta } from "../admin/seo/[entity_type]/[entity_id]/validators"
import {
  AdminGetNotFound,
  AdminGetOldPaths,
  AdminGetRedirects,
  AdminGetSeoResolve,
  AdminGetUrlStyle,
  AdminPostRedirect,
  AdminPostRedirectImport,
  AdminPostReleasePath,
} from "../admin/seo/redirects/validators"

const get = (matcher: string, schema: Parameters<typeof validateAndTransformQuery>[0]) => ({
  matcher,
  methods: ["GET" as const],
  middlewares: [validateAndTransformQuery(schema, {})],
})

/**
 * SEO routes (F3.4, F3.5): a page's own fields (adr/0015), redirect rules,
 * old paths and the 404 log (adr/0017), and the storefront's resolve and
 * 404 report. Integration keys may write rules too: a migration (F14)
 * brings an old site's addresses.
 */
export const SEO_ROUTES = [
  {
    matcher: "/admin/seo/:entity_type/:entity_id",
    methods: ["PUT" as const],
    middlewares: [validateAndTransformBody(AdminPutSeoMeta)],
  },
  get("/admin/seo/redirects", AdminGetRedirects),
  ...["/admin/seo/redirects", "/admin/seo/redirects/:id"].map((matcher) => ({
    matcher,
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(AdminPostRedirect)],
  })),
  // A thousand rows of a few hundred characters each, beyond Express's 100 kB
  {
    matcher: "/admin/seo/redirect-file",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: "2mb" },
    middlewares: [validateAndTransformBody(AdminPostRedirectImport)],
  },
  get("/admin/seo/resolve", AdminGetSeoResolve),
  get("/admin/seo/old-paths", AdminGetOldPaths),
  // Releasing cannot be undone (the path may be taken at once): people only
  {
    matcher: "/admin/seo/old-paths/release",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostReleasePath)],
  },
  get("/admin/seo/not-found", AdminGetNotFound),
  get("/admin/seo/url-style", AdminGetUrlStyle),
  get("/store/seo/resolve", StoreGetSeoResolve),
  {
    matcher: "/store/seo/not-found",
    methods: ["POST" as const],
    middlewares: [
      rateLimit(() => RATE_LIMIT_PROFILES.seo_report),
      validateAndTransformBody(StorePostNotFound),
    ],
  },
]
