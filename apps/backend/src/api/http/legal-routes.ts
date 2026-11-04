import { validateAndTransformBody, validateAndTransformQuery } from "@medusajs/framework/http"
import { AdminPostCategoryRestriction } from "../admin/category-restrictions/validators"
import { AdminGetDashboardNoQuery } from "../admin/dashboard/validators"
import {
  AdminPostPrivacyRequest,
  AdminPostPrivacyRequestClose,
  AdminPostPrivacyRequestEmpty,
} from "../admin/privacy-requests/validators"
import {
  AdminPostLegalDraft,
  AdminPostLegalDraftReset,
  AdminPostLegalPreview,
  AdminPostLegalPublish,
} from "../admin/legal-documents/validators"
import {
  StoreGetCartContract,
  StorePostLegalConsents,
} from "../store/carts/[id]/legal-consents/validators"
import { StorePostAgeDeclaration } from "../store/carts/[id]/age-declaration/validators"
import { StorePostCookieConsent } from "../store/consents/cookies/validators"
import { RATE_LIMIT_PROFILES } from "../../lib/security/rate-limit"
import { rateLimit } from "./rate-limit"
import { requireUserActor } from "./actor"
import { requireReauth } from "./reauth"
import { optionalCustomer, orderAccess } from "./order-access"

const noQuery = validateAndTransformQuery(AdminGetDashboardNoQuery, {})

/** A legal text's draft and preview bodies, as the content pages' (content-routes.ts). */
export const LEGAL_BODY_LIMIT = "1mb"

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
  // A long legal text is past Express's 100 kB default (starters run 10–29 kB of
  // text, more as JSON); the document's own bounds stay (lib/content)
  {
    matcher: "/admin/legal-documents/:kind/draft",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: LEGAL_BODY_LIMIT },
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostLegalDraft)],
  },
  {
    matcher: "/admin/legal-documents/:kind/draft",
    methods: ["DELETE" as const],
    middlewares: [requireUserActor],
  },
  // The draft started again from the starter or the published text (the owner, 2026-11-04)
  {
    matcher: "/admin/legal-documents/:kind/draft/reset",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostLegalDraftReset)],
  },
  {
    matcher: "/admin/legal-documents/:kind/publish",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: LEGAL_BODY_LIMIT },
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostLegalPublish)],
  },
  {
    matcher: "/admin/legal-documents/:kind/preview",
    methods: ["POST" as const],
    bodyParser: { sizeLimit: LEGAL_BODY_LIMIT },
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
  // F13.3: a restricted cart's buyer declares their age; the date of birth is not kept
  {
    matcher: "/store/carts/:id/age-declaration",
    methods: ["GET" as const],
    middlewares: [noQuery],
  },
  {
    matcher: "/store/carts/:id/age-declaration",
    methods: ["POST" as const],
    middlewares: [
      // The checkout's budget, per address and per cart
      rateLimit(() => RATE_LIMIT_PROFILES.checkout, { identity: (req) => req.params["id"] }),
      validateAndTransformBody(StorePostAgeDeclaration),
    ],
  },
  // F13.4: categories marked adults only (who may is the role table's)
  {
    matcher: "/admin/category-restrictions",
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  },
  {
    matcher: "/admin/category-restrictions/:category_id",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostCategoryRestriction)],
  },
  // F13.5: a customer's KVKK requests, recorded and answered by staff
  {
    matcher: "/admin/customers/:id/privacy-requests",
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  },
  {
    matcher: "/admin/customers/:id/privacy-requests",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPrivacyRequest)],
  },
  {
    matcher: "/admin/privacy-requests/:id/export",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPrivacyRequestEmpty)],
  },
  // No way back: the staff member proves themselves again (adr/0040 §3)
  {
    matcher: "/admin/privacy-requests/:id/erase",
    methods: ["POST" as const],
    middlewares: [
      requireUserActor,
      requireReauth(),
      validateAndTransformBody(AdminPostPrivacyRequestEmpty),
    ],
  },
  {
    matcher: "/admin/privacy-requests/:id/close",
    methods: ["POST" as const],
    middlewares: [requireUserActor, validateAndTransformBody(AdminPostPrivacyRequestClose)],
  },
  ...["/admin/orders/:id/legal", "/admin/orders/:id/legal/:kind"].map((matcher) => ({
    matcher,
    methods: ["GET" as const],
    middlewares: [requireUserActor, noQuery],
  })),
]
