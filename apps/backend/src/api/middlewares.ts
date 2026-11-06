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
  AdminPostConvertDefinition,
  AdminUpdateAttributeTemplate,
} from "./admin/attribute-templates/validators"
import {
  AdminGetAsyncJobs,
  AdminPostAsyncJob,
  AdminPostAsyncJobCancel,
} from "./admin/async-jobs/validators"
import { AdminGetAuditLog } from "./admin/audit-log/validators"
import { AdminGetHomeSummary } from "./admin/home/summary/validators"
import { PANEL_ROUTES } from "./admin/panel-routes"
import { AdminPostRevealTaxId } from "./admin/customers/[id]/billing-profile/reveal/validators"
import { REAUTH_ROUTES } from "./http/reauth-routes"
import { STAFF_ROUTES } from "./http/staff-routes"
import { STAFF_ACCOUNT_ROUTES } from "./http/staff-account-routes"
import { WEBHOOK_ROUTES } from "./http/webhook-routes"
import { AdminPostProductAttributes } from "./admin/products/[id]/attributes/validators"
import { AdminPostDescriptionFactsPreview } from "./admin/description-facts/preview/validators"
import { AdminPostProductCatalog } from "./admin/products/[id]/catalog/validators"
import { VariantImagesInput } from "../lib/catalog/variant-images"
import { AdminPostFeature, validateSectionBody } from "./admin/platform-settings/validators"
import { auditMutations, auditSensitiveRead } from "./http/audit"
import { storeProfileOf } from "./http/client-ip"
import { ACCOUNT_ROUTES } from "./http/account-routes"
import { ADDON_ROUTES } from "./http/addon-routes"
import { BANK_TRANSFER_ROUTES } from "./http/bank-transfer-routes"
import { CUSTOMER_SEGMENT_ROUTES } from "./http/customer-segment-routes"
import { CAMPAIGN_ROUTES } from "./http/campaign-routes"
import { BRAND_ROUTES, STORE_BRAND_FIELDS } from "./http/brand-routes"
import { SEARCH_ROUTES } from "./http/search-routes"
import { VAT_ROUTES } from "./http/vat-routes"
import { CATALOG_SHEET_ROUTES } from "./http/catalog-sheet-routes"
import { CHARGEBACK_ROUTES } from "./http/chargeback-routes"
import { COMMUNICATION_ROUTES } from "./http/communication-routes"
import { CONTACT_ROUTES } from "./http/contact-routes"
import { EMAIL_LINK_ROUTES } from "./http/email-link-routes"
import { STOREFRONT_MENU_ROUTES } from "./http/storefront-menu-routes"
import { STOREFRONT_CARD_ROUTES } from "./http/storefront-card-routes"
import { LEGAL_ROUTES } from "./http/legal-routes"
import { MAINTENANCE_ROUTES } from "./http/maintenance-routes"
import { CORE_RETURN_ROUTES } from "./http/core-return-routes"
import { GOOGLE_ROUTES } from "./http/google-routes"
import { EINVOICE_ROUTES } from "./http/einvoice-routes"
import { INVOICE_ROUTES } from "./http/invoice-routes"
import { MIGRATION_ROUTES } from "./http/migration-routes"
import { MARKETING_ROUTES } from "./http/marketing-routes"
import { ORDER_EDIT_ROUTES } from "./http/order-edit-routes"
import { PAYMENT_LINK_ROUTES } from "./http/payment-link-routes"
import { RETURN_ROUTES } from "./http/return-routes"
import { REVIEW_ROUTES } from "./http/review-routes"
import { MESSAGING_ROUTES } from "./http/messaging-routes"
import { SHIPPING_ROUTES } from "./http/shipping-routes"
import { CONTENT_ROUTES } from "./http/content-routes"
import { CONTENT_DRAFT_ROUTES } from "./http/content-draft-routes"
import { DEV_ROUTES } from "./http/dev-routes"
import { SENSITIVE_READS } from "./http/audit/sensitive-routes"
import { csrfProtection } from "./http/csrf"
import { platformErrorHandler } from "./http/error-handler"
import { authIdentity, authProfile, rateLimit } from "./http/rate-limit"
import { requireUserActor } from "./http/actor"
import { requestContext } from "./http/request-id"
import { rejectAmbiguousPath } from "./http/request-path"
import { adminLimitGuard, storeLimitGuard, uploadSizeGate } from "./http/request-limits"
import { securityHeaders } from "./http/security-headers"
import {
  MEDIA_ROUTES,
  STORE_MEDIA_FIELDS,
  STORE_VARIANT_IMAGE_FIELDS,
  restrictStoreMediaFields,
} from "./http/media-routes"
import { GIFT_CARD_ROUTES } from "./http/gift-card-routes"
import { GIFT_CARD_SALE_ROUTES, STORE_GIFT_PRODUCT_FIELDS } from "./http/gift-card-sale-routes"
import { ORDER_REFUND_ROUTES } from "./http/order-refund-routes"
import { PAYMENT_ROUTES } from "./http/payment-routes"
import { FRAUD_ROUTES } from "./http/fraud-routes"
import { INTEGRATION_ROUTES } from "./http/integration-routes"
import { restrictStoreGiftCardFields } from "./http/shopper-gift-cards"
import { PRICING_ROUTES } from "./http/pricing-routes"
import { PROMOTION_ROUTES } from "./http/promotion-routes"
import { SEO_ROUTES } from "./http/seo-routes"
import { STOCK_ROUTES } from "./http/stock-routes"
import { uploadValidator } from "./http/upload-validator"
import { StorePostPrivacyRequest } from "./store/customers/me/privacy-requests/validators"
import { StorePostBillingProfile } from "./store/customers/me/billing-profile/validators"
import { GetTrDistricts, GetTrNeighborhoods, GetTrProvinces } from "./tr-address/validators"
import {
  STORE_ATTRIBUTE_FIELDS,
  rejectStoreVariantExtension,
  restrictStoreAttributeFields,
} from "./validation/attribute-fields"
import { slugHandles } from "./validation/catalog-handles"
import { rejectStoreSeoFields } from "./validation/seo-fields"
import { rejectSensitiveFields } from "./validation/sensitive-fields"
import { guardApiKeys } from "./http/api-key-guard"
import { hidePrivateAttributes } from "./http/attribute-visibility"
import { guardStaffRoles } from "./http/staff-guard"
import { recordSearchTerms } from "./http/search-terms"
import { closePresignedUploads, hideJobResultFiles } from "./validation/upload-routes"
import {
  ROOT,
  existingCartAddresses,
  existingCustomerAddress,
  validateTrAddresses,
} from "./validation/tr-address"

const CART_ADDRESSES = ["shipping_address", "billing_address"] as const

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
        rateLimit(storeProfileOf),
        storeLimitGuard,
        rejectSensitiveFields,
        restrictStoreAttributeFields,
        rejectStoreVariantExtension,
        restrictStoreMediaFields,
        rejectStoreSeoFields,
        restrictStoreGiftCardFields,
      ],
    },
    // F2.5: admin mutations are recorded once answered (adr/0011); tax ids
    // are never expanded through `fields`. F11.6: a secret API key reaches
    // only its scopes' routes, F12.6: a staff member only their role's
    // (Medusa's own authentication has run by now)
    {
      matcher: "/admin/*",
      middlewares: [
        rateLimit(() => RATE_LIMIT_PROFILES.admin_default),
        adminLimitGuard,
        guardApiKeys,
        guardStaffRoles,
        rejectSensitiveFields,
        auditMutations,
      ],
    },
    // F3.1: handles are storefront slugs. Without `methods` this runs before
    // the core routes validate the body, so the handle it fills reaches them
    ...["/admin/products", "/admin/product-categories", "/admin/collections"].map((matcher) => ({
      matcher,
      middlewares: [slugHandles],
    })),
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
    // The viewer's filter (F12.5): names only, people only
    {
      matcher: "/admin/audit-log/resource-types",
      methods: ["GET"],
      middlewares: [requireUserActor],
    },
    // The Integrations page (F12.2): people only
    {
      matcher: "/admin/integrations/overview",
      methods: ["GET"],
      middlewares: [requireUserActor],
    },
    // F2.3: settings sections and flags, each body checked by its own schema
    // (adr/0012); people only, by role (adr/0040): robots.txt or a flag is
    // not a change for an integration key
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
    // allowFields runs before the core route checks `fields`; the answer loses
    // the attributes the shop keeps to itself (T5), here and on a product's page
    {
      matcher: "/store/products",
      middlewares: [
        allowFields(
          ...STORE_ATTRIBUTE_FIELDS,
          ...STORE_BRAND_FIELDS,
          ...STORE_MEDIA_FIELDS,
          ...STORE_VARIANT_IMAGE_FIELDS,
          ...STORE_GIFT_PRODUCT_FIELDS
        ),
        hidePrivateAttributes,
      ],
    },
    // F11.8: the product list's searches counted for the report and the advisor
    {
      matcher: "/store/products",
      methods: ["GET"],
      middlewares: [recordSearchTerms],
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
    // adr/0013 Ek 2026-11-05: a text attribute with values turned into a single choice
    {
      matcher: "/admin/attribute-templates/:id/definitions/:definition_id/convert",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminPostConvertDefinition)],
    },
    {
      matcher: "/admin/products/:id/attributes",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminPostProductAttributes)],
    },
    // adr/0013 Ek 2026-11-05: the facts in products' descriptions, previewed
    {
      matcher: "/admin/description-facts/preview",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminPostDescriptionFactsPreview)],
    },
    // A new product's variant pictures, picked before it existed: tied within the create's workflow
    {
      matcher: "/admin/products",
      methods: ["POST"],
      additionalDataValidator: { variant_images: VariantImagesInput.optional() },
    },
    // A long description document is past Express's 100 kB default; its own bounds stay (adr/0055)
    {
      matcher: "/admin/products/:id/catalog",
      methods: ["POST"],
      bodyParser: { sizeLimit: "1mb" },
      middlewares: [validateAndTransformBody(AdminPostProductCatalog)],
    },
    // F3.4, F3.5: a page's own SEO fields, redirects, the 404 log
    ...SEO_ROUTES,
    // F5: the shop's provider accounts (adr/0027)
    ...INTEGRATION_ROUTES,
    ...PAYMENT_ROUTES,
    // adr/0028: the payment test page, development only
    ...DEV_ROUTES,
    ...ORDER_REFUND_ROUTES,
    ...BANK_TRANSFER_ROUTES,
    ...CHARGEBACK_ROUTES,
    ...COMMUNICATION_ROUTES,
    ...LEGAL_ROUTES,
    ...SHIPPING_ROUTES,
    // F11.7: outgoing webhooks
    ...WEBHOOK_ROUTES,
    ...STAFF_ROUTES,
    ...STAFF_ACCOUNT_ROUTES,
    ...REAUTH_ROUTES,
    {
      matcher: "/admin/customers/:id/billing-profile/reveal",
      methods: ["POST"],
      middlewares: [validateAndTransformBody(AdminPostRevealTaxId)],
    },
    ...MESSAGING_ROUTES,
    ...ACCOUNT_ROUTES,
    ...CUSTOMER_SEGMENT_ROUTES,
    // adr/0050: bulk e-mail and SMS, behind their flag
    ...CAMPAIGN_ROUTES,
    ...REVIEW_ROUTES,
    ...CONTACT_ROUTES,
    ...EMAIL_LINK_ROUTES,
    ...STOREFRONT_MENU_ROUTES,
    // adr/0053: maintenance mode's bypass link
    ...MAINTENANCE_ROUTES,
    ...MARKETING_ROUTES,
    ...GOOGLE_ROUTES,
    ...EINVOICE_ROUTES,
    ...INVOICE_ROUTES,
    ...RETURN_ROUTES,
    ...CORE_RETURN_ROUTES,
    ...ORDER_EDIT_ROUTES,
    // adr/0051: payment links behind their flag; a link's cart locked; Medusa's draft orders closed
    ...PAYMENT_LINK_ROUTES,
    // F3.11: brands
    ...BRAND_ROUTES,
    // adr/0046 Ek 2026-11-04: category pictures, product cards' stock and quick add
    ...STOREFRONT_CARD_ROUTES,
    // adr/0056: site search's synonym groups
    ...SEARCH_ROUTES,
    // adr/0007 Ek 2026-11-04: the KDV rates
    ...VAT_ROUTES,
    ...CONTENT_ROUTES,
    ...CONTENT_DRAFT_ROUTES,
    // F3.9: product sheets
    ...CATALOG_SHEET_ROUTES,
    ...MIGRATION_ROUTES,
    ...FRAUD_ROUTES,
    // F3.7: warehouses
    ...STOCK_ROUTES,
    // F3.3: product images
    ...MEDIA_ROUTES,
    // F4.4/F4.6: promotion codes
    ...PROMOTION_ROUTES,
    // F4.3: price display
    ...PRICING_ROUTES,
    // F4.8: gift cards and store credit, behind their flag
    ...GIFT_CARD_ROUTES,
    // adr/0025 Ek 2026-11-03: selling gift cards (a line's recipient, a balance by code)
    ...GIFT_CARD_SALE_ROUTES,
    // adr/0052: product add-ons (a line's picks priced on the server)
    ...ADDON_ROUTES,
    // docs/17: the home page's order numbers are for people (shop revenue)
    {
      matcher: "/admin/home/summary",
      methods: ["GET"],
      middlewares: [requireUserActor, validateAndTransformQuery(AdminGetHomeSummary, {})],
    },
    // The panel's read models and actions (adr/0022)
    ...PANEL_ROUTES,
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
      matcher: "/admin/async-jobs/:id/cancel",
      methods: ["POST"],
      middlewares: [requireUserActor, validateAndTransformBody(AdminPostAsyncJobCancel)],
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
      middlewares: [validateAndTransformQuery(GetTrProvinces, {})],
    },
    {
      matcher: "/store/tr-address/districts",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(GetTrDistricts, {})],
    },
    {
      matcher: "/store/tr-address/neighborhoods",
      methods: ["GET"],
      middlewares: [validateAndTransformQuery(GetTrNeighborhoods, {})],
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
    // F18 D8: the customer's own KVKK requests (adr/0041 §6)
    {
      matcher: "/store/customers/me/privacy-requests",
      methods: ["GET"],
      middlewares: [authenticate("customer", ["session", "bearer"])],
    },
    {
      matcher: "/store/customers/me/privacy-requests",
      methods: ["POST"],
      middlewares: [
        authenticate("customer", ["session", "bearer"]),
        validateAndTransformBody(StorePostPrivacyRequest),
      ],
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
