import type { Method, Rule } from "../staff/permission-rules"

/**
 * What a restricted or suspended shop may still write (adr/0061 §5.5, Ek
 * C15). `OPEN` is the allow-list, every rule an exact path: a new route
 * never opens by falling under one. `CLOSED` names the rest, by area; a
 * write in neither is closed too (default closed), and the unit test fails
 * on any route of ours or Medusa's that has no rule. Reads stay open.
 */

const WRITES: readonly Method[] = ["POST", "PUT", "PATCH", "DELETE"]
const POST: readonly Method[] = ["POST"]
const DELETE: readonly Method[] = ["DELETE"]

/**
 * Long tasks a restricted shop may still start: files of what it has
 * (its orders, reports, accounting, a customer's KVKK copy, the audit log,
 * the catalog). Imports, bulk edits, code batches and the rest write.
 */
export const PLAN_OPEN_JOBS: ReadonlySet<string> = new Set([
  "accounting.package",
  "audit_log.export",
  "catalog.export",
  "customer.data_export",
  "order.export",
  "report.export",
])

const open = (methods: readonly Method[], paths: readonly string[]): Rule[] =>
  paths.map((path) => ({ methods, path }))

export const PLAN_OPEN: readonly Rule[] = [
  // An order's day: its address and e-mail, shipping, delivery, cancelling, completing
  ...open(POST, [
    "/admin/orders/:id",
    "/admin/orders/:id/archive",
    "/admin/orders/:id/cancel",
    "/admin/orders/:id/complete",
    "/admin/orders/:id/ship",
    "/admin/orders/:id/fulfillments",
    "/admin/orders/:id/fulfillments/:fulfillment_id/cancel",
    "/admin/orders/:id/fulfillments/:fulfillment_id/mark-as-delivered",
    "/admin/orders/:id/fulfillments/:fulfillment_id/shipments",
    "/admin/fulfillments",
    "/admin/fulfillments/:id/cancel",
    "/admin/fulfillments/:id/shipment",
    "/admin/order-board/ship",
    "/admin/order-board/deliver",
    "/admin/order-changes/:id",
    "/admin/orders/:id/transfer",
    "/admin/orders/:id/transfer/cancel",
    "/admin/orders/:id/transfer/guest",
    // Its lines and addresses corrected (adr/0033), its notes and messages
    "/admin/orders/:id/edit",
    "/admin/orders/:id/edit/preview",
    "/admin/orders/:id/notes",
    "/admin/orders/:id/messages/:message_id/resend",
  ]),
  { methods: DELETE, path: "/admin/orders/:id/notes/:note_id" },
  // Its money: a transfer confirmed, a refund, store credit, a capture, a chargeback,
  // a held order released, the provider's statement checked
  ...open(POST, [
    "/admin/orders/:id/bank-transfer/confirm",
    "/admin/orders/:id/refunds",
    "/admin/orders/:id/refunds/preview",
    "/admin/orders/:id/refunds/:reference/settle",
    "/admin/orders/:id/credit-lines",
    "/admin/orders/:id/payment-sessions/authorize",
    "/admin/payments/:id/capture",
    "/admin/payments/:id/refund",
    "/admin/payment-collections",
    "/admin/payment-collections/:id/mark-as-paid",
    "/admin/payment-collections/:id/payment-sessions",
    "/admin/chargebacks",
    "/admin/chargebacks/:id",
    "/admin/fraud/reviews/:id/decision",
    "/admin/reports/statements",
    // A payment link stopped (making, sending or extending one sells anew)
    "/admin/payment-links/:id/cancel",
    // A bulk message stopped (review M1): pausing or cancelling only ends sending
    "/admin/bulk-messages/:id/pause",
    "/admin/bulk-messages/:id/cancel",
  ]),
  // The shop's Google account disconnected (review M1): its products stop going out
  { methods: DELETE, path: "/admin/google" },
  { methods: DELETE, path: "/admin/payment-collections/:id" },
  // Returns (the shopper's legal right, adr/0032)
  ...open(POST, [
    "/admin/orders/:id/return-requests",
    "/admin/return-requests/:id/approve",
    "/admin/return-requests/:id/cancel",
    "/admin/return-requests/:id/receive",
    "/admin/return-requests/:id/refund",
    "/admin/return-requests/:id/reject",
  ]),
  // Invoices and the accountant's sync (adr/0034)
  ...open(POST, [
    "/admin/invoices/retry",
    "/admin/invoices/:id/issued",
    "/admin/invoices/:id/pdf",
    "/admin/invoices/:id/retry",
    "/admin/invoices/:id/return-document",
    "/admin/invoices/:id/waive",
    "/admin/accounting/syncs/:id/retry",
  ]),
  // Stock on the shelf and what orders hold of it
  ...open(POST, [
    "/admin/inventory-items/location-levels/batch",
    "/admin/inventory-items/:id/location-levels",
    "/admin/inventory-items/:id/location-levels/batch",
    "/admin/inventory-items/:id/location-levels/:location_id",
    "/admin/reservations",
    "/admin/reservations/:id",
    "/admin/stock-items/:id/watch",
  ]),
  { methods: DELETE, path: "/admin/reservations/:id" },
  // KVKK: a request recorded and answered, consent withdrawn, an address that
  // must not be written to again; a sealed tax id read (a read, audited)
  ...open(POST, [
    "/admin/customers/:id/privacy-requests",
    "/admin/privacy-requests/:id/close",
    "/admin/privacy-requests/:id/erase",
    "/admin/privacy-requests/:id/export",
    "/admin/customers/:id/consents",
    "/admin/messaging/suppressions",
    "/admin/customers/:id/billing-profile/reveal",
    // A traveler's full ID or passport number for the departure's list (adr/0076 §7)
    "/admin/booking-travelers/:id/reveal",
    // A contact form message marked answered: the shop still answers its customers
    "/admin/contact-messages/:id",
  ]),
  // Files of what the shop has
  ...open(POST, [
    "/admin/order-board/export",
    "/admin/orders/export",
    "/admin/products/export",
    "/admin/inventory-items/export",
  ]),
  {
    methods: POST,
    path: "/admin/async-jobs",
    when: (facts) => facts.jobType !== undefined && PLAN_OPEN_JOBS.has(facts.jobType),
  },
  { methods: POST, path: "/admin/async-jobs/:id/cancel" },
  // One's own account; an invitation sent before is honoured (as in Ek C14)
  ...open(POST, [
    "/admin/staff/me/profile",
    "/admin/staff/me/password",
    "/admin/staff/me/email",
    "/admin/staff/me/email/cancel",
    "/admin/staff/me/email/confirm",
    "/admin/staff/me/sessions/end-others",
    "/admin/staff/invites/info",
    "/admin/staff/invites/accept",
    // One's own alerts marked read: the person's own state, while orders still come in
    "/admin/alerts/read",
  ]),
  // Taking access away is never closed: a member who left, an invitation, a key, a
  // webhook, the feed's link; a member locked out of their 2FA let back in
  ...open(DELETE, [
    "/admin/staff/members/:id",
    "/admin/staff/invites/:id",
    "/admin/api-access/:id",
    "/admin/webhooks/:id",
    "/admin/marketing-feeds/token",
  ]),
  ...open(POST, ["/admin/api-access/:id/revoke", "/admin/staff/members/:id/reset-mfa"]),
  // ADR-0068 §9: a wholesaler closed (pays retail from the next request), a pending
  // invitation taken back (review L6: taking access away); reopening sells anew
  { methods: POST, path: "/admin/wholesale/accounts/:id/deactivate" },
  { methods: DELETE, path: "/admin/wholesale/accounts/:id" },
]

const closed = (paths: readonly string[]): Rule[] =>
  paths.map((path) => ({ methods: WRITES, path }))

/**
 * The closed areas, named so that every write route has a decision: the
 * catalog, campaigns, settings, messaging, the team, content and the
 * storefront's design. Medusa's own routes our app already closes
 * (returns, claims, exchanges, order edits, draft orders, invites,
 * imports) are closed here too.
 */
export const PLAN_CLOSED: readonly Rule[] = closed([
  // Catalog
  "/admin/products*",
  "/admin/product-categories*",
  "/admin/product-options*",
  "/admin/product-tags*",
  "/admin/product-types*",
  "/admin/collections*",
  "/admin/collection-board*",
  "/admin/attribute-templates*",
  "/admin/description-facts*",
  "/admin/brands*",
  "/admin/category-images*",
  "/admin/category-descriptions*",
  "/admin/category-restrictions*",
  "/admin/catalog*",
  // Dated products' departures (adr/0076); their settings are under /admin/products
  "/admin/booking-slots*",
  "/admin/media*",
  "/admin/uploads*",
  "/admin/migrations*",
  "/admin/inventory-items*",
  "/admin/property-labels*",
  "/admin/price-lists*",
  "/admin/price-preferences*",
  "/admin/translations*",
  // The loyalty plugin's (review L2): a new gift card sells, store credit given by hand
  // is money; an order's refund goes back through its own open route
  "/admin/gift-cards*",
  "/admin/store-credit-accounts*",
  // Campaigns and selling anew
  "/admin/promotions*",
  "/admin/campaigns*",
  "/admin/customer-segments*",
  "/admin/customer-groups*",
  "/admin/customers*",
  // ADR-0068 §9: wholesale levels, accounts and prices are selling anew; closing an account opens
  "/admin/wholesale*",
  "/admin/abandoned-carts*",
  "/admin/payment-links*",
  "/admin/draft-orders*",
  "/admin/marketing-feeds*",
  "/admin/google*",
  "/admin/bulk-messages*",
  // Content, reviews and the storefront
  "/admin/content*",
  // adr/0071 §6: AI suggestions and their decisions write as content does
  "/admin/ai*",
  "/admin/landings*",
  "/admin/legal-documents*",
  "/admin/product-reviews*",
  "/admin/product-questions*",
  "/admin/product-answers*",
  "/admin/contact-messages*",
  "/admin/storefront-layout*",
  "/admin/storefront-menus*",
  "/admin/storefront-presets*",
  "/admin/storefront-designs*",
  "/admin/seo*",
  "/admin/search*",
  "/admin/search-indexes*",
  "/admin/index*",
  "/admin/maintenance*",
  // Settings, providers and keys
  "/admin/platform-settings*",
  "/admin/features*",
  "/admin/integrations*",
  "/admin/einvoice*",
  "/admin/messaging*",
  "/admin/shipping-setup*",
  "/admin/shipping-options*",
  "/admin/shipping-option-types*",
  "/admin/shipping-profiles*",
  "/admin/fulfillment-sets*",
  "/admin/stock-locations*",
  "/admin/warehouses*",
  "/admin/vat-rates*",
  "/admin/tax-rates*",
  "/admin/tax-regions*",
  "/admin/regions*",
  "/admin/sales-channels*",
  "/admin/stores*",
  "/admin/refund-reasons*",
  "/admin/return-reasons*",
  "/admin/fraud*",
  "/admin/api-access*",
  "/admin/api-keys*",
  "/admin/webhooks*",
  "/admin/layouts*",
  "/admin/views*",
  "/admin/workflows-executions*",
  "/admin/async-jobs*",
  // The team
  "/admin/staff*",
  "/admin/users*",
  "/admin/invites*",
  "/admin/rbac*",
  // Medusa's own order changes, closed by our app already (adr/0032, adr/0033)
  "/admin/returns*",
  "/admin/claims*",
  "/admin/exchanges*",
  "/admin/order-edits*",
  // An order's other writes, and an exception the allow-list does not name
  "/admin/orders*",
  "/admin/order-board*",
  "/admin/payments*",
  "/admin/payment-collections*",
  "/admin/fulfillments*",
  "/admin/reservations*",
  "/admin/return-requests*",
  "/admin/invoices*",
  "/admin/accounting*",
  "/admin/chargebacks*",
  "/admin/reports*",
  "/admin/privacy-requests*",
  "/admin/stock-items*",
  "/admin/order-changes*",
])
