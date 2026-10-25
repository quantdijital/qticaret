import {
  allowFields,
  authenticate,
  defineMiddlewares,
  validateAndTransformBody,
  validateAndTransformQuery,
} from "@medusajs/framework/http"
import { RATE_LIMIT_PROFILES } from "../lib/security/rate-limit"
import {
  AdminGetAttributeTemplates,
  AdminPostAttributeTemplate,
  AdminUpdateAttributeTemplate,
} from "./admin/attribute-templates/validators"
import { AdminGetAsyncJobs, AdminPostAsyncJob } from "./admin/async-jobs/validators"
import { AdminGetAuditLog } from "./admin/audit-log/validators"
import { AdminPostProductAttributes } from "./admin/products/[id]/attributes/validators"
import { AdminPostFeature, validateSectionBody } from "./admin/platform-settings/validators"
import { auditMutations, auditSensitiveRead } from "./http/audit"
import { csrfProtection } from "./http/csrf"
import { platformErrorHandler } from "./http/error-handler"
import { authIdentity, authProfile, rateLimit } from "./http/rate-limit"
import { requireUserActor } from "./http/actor"
import { requestContext } from "./http/request-id"
import { rejectAmbiguousPath } from "./http/request-path"
import { adminLimitGuard, storeLimitGuard, uploadSizeGate } from "./http/request-limits"
import { securityHeaders } from "./http/security-headers"
import { uploadValidator } from "./http/upload-validator"
import { StorePostBillingProfile } from "./store/customers/me/billing-profile/validators"
import {
  StoreGetTrDistricts,
  StoreGetTrNeighborhoods,
  StoreGetTrProvinces,
} from "./store/tr-address/validators"
import { STORE_ATTRIBUTE_FIELDS, restrictStoreAttributeFields } from "./validation/attribute-fields"
import { rejectSensitiveFields } from "./validation/sensitive-fields"
import { closePresignedUploads, hideJobResultFiles } from "./validation/upload-routes"
import {
  ROOT,
  existingCartAddresses,
  existingCustomerAddress,
  validateTrAddresses,
} from "./validation/tr-address"

const CART_ADDRESSES = ["shipping_address", "billing_address"] as const

// Admin GET routes that return personal data: [matcher, resource type, list,
// fields that show none] (adr/0011). A phase adding such a route adds it here
// (code-reviewer checklist).
const SENSITIVE_READS: readonly [string, string, boolean, (readonly string[])?][] = [
  ["/admin/customers", "customer", true],
  ["/admin/customers/:id", "customer", false],
  ["/admin/customers/:id/addresses", "customer", false],
  ["/admin/customers/:id/addresses/:address_id", "customer", false],
  ["/admin/customers/:id/billing-profile", "customer", false],
  ["/admin/customer-groups/:id", "customer_group", false],
  ["/admin/orders", "order", true],
  ["/admin/orders/:id", "order", false],
  ["/admin/orders/:id/preview", "order", false],
  ["/admin/orders/:id/changes", "order", false],
  ["/admin/draft-orders", "draft_order", true],
  ["/admin/draft-orders/:id", "draft_order", false],
  ["/admin/returns", "return", true],
  ["/admin/returns/:id", "return", false],
  ["/admin/claims", "claim", true],
  ["/admin/claims/:id", "claim", false],
  ["/admin/exchanges", "exchange", true],
  ["/admin/exchanges/:id", "exchange", false],
  ["/admin/notifications", "notification", true, ["id", "created_at"]],
  ["/admin/notifications/:id", "notification", false],
]

export default defineMiddlewares({
  // F2.10: sanitized error bodies with request_id, logged with redaction
  errorHandler: platformErrorHandler,
  routes: [
    // F2.10: validated request ID and log context, security headers, CSRF;
    // these run after Medusa's body parser, CORS and authentication
    {
      matcher: "/*",
      middlewares: [
        requestContext,
        rejectAmbiguousPath,
        securityHeaders,
        csrfProtection,
        uploadSizeGate,
      ],
    },
    // F2.10: rate limits per area; login, registration and reset per identity too
    {
      matcher: "/auth/*",
      methods: ["POST"],
      middlewares: [rateLimit(authProfile, { identity: authIdentity })],
    },
    {
      matcher: "/store/*",
      middlewares: [
        rateLimit(() => RATE_LIMIT_PROFILES.store_default),
        storeLimitGuard,
        rejectSensitiveFields,
        restrictStoreAttributeFields,
      ],
    },
    // F2.5: admin mutations are recorded once answered (adr/0011); tax ids
    // are never expanded through `fields`
    {
      matcher: "/admin/*",
      middlewares: [
        rateLimit(() => RATE_LIMIT_PROFILES.admin_default),
        adminLimitGuard,
        rejectSensitiveFields,
        auditMutations,
      ],
    },
    // F2.5: reads that return personal data (names, contact details,
    // addresses) are recorded before the answer, or refused
    ...SENSITIVE_READS.map(([matcher, resourceType, list, safeFields]) => ({
      matcher,
      methods: ["GET" as const],
      middlewares: [auditSensitiveRead(resourceType, { list, safeFields: safeFields ?? [] })],
    })),
    {
      matcher: "/admin/audit-log",
      methods: ["GET"],
      middlewares: [
        requireUserActor,
        validateAndTransformQuery(AdminGetAuditLog, {}),
        auditSensitiveRead("audit_log", { list: true }),
      ],
    },
    // F2.3: settings sections and flags, each body checked by its own schema
    // (adr/0012); people only until roles arrive (F12): robots.txt or a flag
    // is not a change for an integration key
    {
      matcher: "/admin/platform-settings/:section",
      methods: ["POST"],
      middlewares: [requireUserActor, validateSectionBody],
    },
    {
      matcher: "/admin/features/:key",
      methods: ["POST"],
      middlewares: [requireUserActor, validateAndTransformBody(AdminPostFeature)],
    },
    // F2.4: attribute templates and product values (adr/0013); global so
    // allowFields runs before the core route checks `fields`
    {
      matcher: "/store/products",
      middlewares: [allowFields(...STORE_ATTRIBUTE_FIELDS)],
    },
    {
      matcher: "/admin/attribute-templates",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(AdminGetAttributeTemplates, {})],
    },
    {
      matcher: "/admin/attribute-templates",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminPostAttributeTemplate)],
    },
    {
      matcher: "/admin/attribute-templates/:id",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminUpdateAttributeTemplate)],
    },
    {
      matcher: "/admin/products/:id/attributes",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminPostProductAttributes)],
    },
    // F2.8: long tasks (adr/0014); starting one and fetching its result are
    // for people: results can hold personal data (the audit log export)
    {
      matcher: "/admin/async-jobs",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(AdminGetAsyncJobs, {})],
    },
    {
      matcher: "/admin/async-jobs",
      methods: ["POST"],
      middlewares: [requireUserActor, validateAndTransformBody(AdminPostAsyncJob)],
    },
    {
      matcher: "/admin/async-jobs/:id/result",
      methods: ["GET"],
      middlewares: [requireUserActor],
    },
    {
      matcher: "/admin/uploads/:id",
      methods: ["GET", "DELETE"],
      middlewares: [hideJobResultFiles],
    },
    {
      matcher: "/admin/uploads/presigned-urls",
      methods: ["POST"],
      middlewares: [closePresignedUploads],
    },
    // F2.9b: uploaded files checked by their bytes, after Medusa's multer
    {
      matcher: "/admin/uploads",
      methods: ["POST"],
      middlewares: [uploadValidator],
    },
    {
      matcher: "/store/tr-address/provinces",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrProvinces, {})],
    },
    {
      matcher: "/store/tr-address/districts",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrDistricts, {})],
    },
    {
      matcher: "/store/tr-address/neighborhoods",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(StoreGetTrNeighborhoods, {})],
    },
    // F1.4: Turkish address checks on core routes; they run after Medusa's
    // own authentication and body validation for these routes.
    {
      matcher: "/store/customers/me/addresses",
      methods: ["POST"],
      middlewares: [validateTrAddresses([ROOT])],
    },
    {
      matcher: "/store/customers/me/addresses/:address_id",
      methods: ["POST"],
      middlewares: [validateTrAddresses([ROOT], existingCustomerAddress)],
    },
    {
      matcher: "/store/carts",
      methods: ["POST"],
      middlewares: [validateTrAddresses([...CART_ADDRESSES])],
    },
    // F1.5: billing profile; the explicit authenticate keeps the route
    // protected even if core matchers for /store/customers/me change.
    {
      matcher: "/store/customers/me/billing-profile",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/billing-profile",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StorePostBillingProfile),
      ],
    },
    {
      matcher: "/store/carts/:id",
      methods: ["POST"],
      middlewares: [validateTrAddresses([...CART_ADDRESSES], existingCartAddresses)],
    },
  ],
})
