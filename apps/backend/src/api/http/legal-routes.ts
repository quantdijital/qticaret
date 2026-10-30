import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostLegalDraft,
  AdminPostLegalPreview,
  AdminPostLegalPublish,
} from "../admin/legal-documents/validators"
import {
  StoreGetCartContract,
  StorePostLegalConsents,
} from "../store/carts/[id]/legal-consents/validators"
import { StorePostCookieConsent } from "../store/consents/cookies/validators"
import { requireUserActor } from "./actor"
import { optionalCustomer, orderAccess } from "./order-access"

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

/**
 * F13.1 (adr/0041 §1): the shop's legal texts. People edit and publish
 * them (who may is the role table's: not operations, not read-only); the
 * storefront reads the published ones. F13.2 (§2): the checkout shows the
 * contracts filled for the cart and records their acceptance; the order
 * keeps its copies, for its shopper and the shop's staff. F13.8 (§5): the
 * cookie banner's answers, by the storefront's own visitor cookie.
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
    matcher: "/store/legal-identity",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/store/legal/:kind",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(AdminGetDashboardNoQuery, {})],
  },
  {
    matcher: "/store/carts/:id/legal/:kind",
    methods: ["GET" as const],
    middlewares: [validateAndTransformQuery(StoreGetCartContract, {})],
  },
  {
    matcher: "/store/carts/:id/legal-consents",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(StorePostLegalConsents)],
  },
  {
    matcher: "/store/orders/:id/legal/:kind",
    methods: ["GET" as const],
    middlewares: [optionalCustomer, orderAccess, noQuery],
  },
  {
    matcher: "/store/consents/cookies",
    methods: ["GET" as const],
    middlewares: [noQuery],
  },
  {
    matcher: "/store/consents/cookies",
    methods: ["POST" as const],
    middlewares: [validateAndTransformBody(StorePostCookieConsent)],
  },
  ...["/admin/orders/:id/legal", "/admin/orders/:id/legal/:kind"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  })),
]
