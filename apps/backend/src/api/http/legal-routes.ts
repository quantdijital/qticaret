import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostLegalDraft,
  AdminPostLegalPreview,
  AdminPostLegalPublish,
} from "../admin/legal-documents/validators"
import { requireUserActor } from "./actor"

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

/**
 * F13.1 (adr/0041 §1): the shop's legal texts. People edit and publish
 * them (who may is the role table's: not operations, not read-only); the
 * storefront reads the published ones.
 */
export const LEGAL_ROUTES = [
  ...[
    "/admin/legal-documents",
    "/admin/legal-documents/:kind",
    "/admin/legal-documents/:kind/starter",
  ].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  })),
  {
    matcher: "/admin/legal-documents/:kind/draft",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostLegalDraft)],
  },
  {
    matcher: "/admin/legal-documents/:kind/draft",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  {
    matcher: "/admin/legal-documents/:kind/publish",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostLegalPublish)],
  },
  {
    matcher: "/admin/legal-documents/:kind/preview",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostLegalPreview)],
  },
  {
    matcher: "/store/legal/:kind",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
]
