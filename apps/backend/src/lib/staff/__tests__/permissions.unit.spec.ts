import { readFileSync, readdirSync, statSync } from "node:fs"
import { join, relative } from "node:path"
import { STAFF_ROLES, capabilitiesOf, decide } from "../permissions"

const allowed = (...args: Parameters<typeof decide>) => decide(...args).allowed

describe("staff roles", () => {
  it("lets the owner do anything", () => {
    for (const [method, path] of [
      ["POST", "/admin/integrations/credentials/paytr"],
      ["POST", "/admin/api-access"],
      ["DELETE", "/admin/staff/members/user_1"],
      ["POST", "/admin/platform-settings/bank_transfer"],
    ] as const) {
      expect(allowed("owner", method, path)).toBe(true)
    }
  })

  it.each([
    ["DELETE", "/admin/users/user_1"],
    ["DELETE", "/admin/users/user%5F1"],
    ["POST", "/admin/invites"],
    ["POST", "/admin/invites/invite_1/resend"],
    ["DELETE", "/admin/invites/invite_1"],
    ["DELETE", "/admin/customers/cus_1"],
    ["DELETE", "/admin/uploads/media-1.webp"],
    ["POST", "/admin/tax-rates"],
    ["POST", "/admin/tax-rates/txr_1"],
    ["DELETE", "/admin/tax-rates/txr_1"],
    ["POST", "/admin/tax-rates/txr_1/rules"],
    ["POST", "/admin/tax-regions"],
    ["DELETE", "/admin/tax-regions/txreg_1"],
    ["POST", "/admin/product-types"],
    ["POST", "/admin/product-types/ptyp_1"],
    ["DELETE", "/admin/product-types/ptyp_1"],
  ] as const)(
    "keeps Medusa's %s %s from everyone: our own routes do it with their guards",
    (method, path) => {
      for (const role of STAFF_ROLES) {
        expect(decide(role, method, path)).toEqual({ allowed: false, reason: "replaced" })
      }
    }
  )

  it("leaves Medusa's invitation acceptance to the invited", () => {
    expect(allowed("owner", "POST", "/admin/invites/accept")).toBe(true)
  })

  it.each([
    ["POST", "/admin/integrations/credentials/paytr"],
    ["DELETE", "/admin/integrations/credentials/iyzico"],
    ["GET", "/admin/api-access"],
    ["POST", "/admin/api-access/key_1/revoke"],
    ["POST", "/admin/api-keys"],
    ["POST", "/admin/webhooks"],
    ["DELETE", "/admin/webhooks/whsub_1"],
    ["POST", "/admin/platform-settings/accounting"],
    ["POST", "/admin/platform-settings/bank_transfer"],
    ["POST", "/admin/platform-settings/bank%5ftransfer"],
    ["POST", "/admin/platform-settings/%61ccounting"],
    ["POST", "/admin/platform-settings/security"],
    ["POST", "/admin/platform-settings/maintenance"],
    ["POST", "/admin/platform-settings/%6daintenance"],
    ["POST", "/admin/platform-settings/payment_links"],
    ["POST", "/admin/platform-settings/payment%5flinks"],
    ["POST", "/admin/platform-settings/invoicing"],
    ["POST", "/admin/platform-settings/%69nvoicing"],
    ["POST", "/admin/einvoice/parasut"],
    ["DELETE", "/admin/einvoice/parasut"],
    ["POST", "/admin/google/connect"],
    ["DELETE", "/admin/google"],
    ["POST", "/admin/users/user_1"],
    ["GET", "/admin/invites"],
    ["POST", "/admin/staff/members/user_1"],
    ["DELETE", "/admin/staff/members/user_1"],
    ["POST", "/admin/staff/invites"],
    ["POST", "/admin/migrations"],
    ["GET", "/admin/migrations"],
    ["POST", "/admin/%6digrations"],
    ["POST", "/admin/layouts/settings.sidebar"],
    ["POST", "/admin/views/orders/configurations"],
  ] as const)("keeps %s %s the owner's alone", (method, path) => {
    expect(decide("admin", method, path)).toEqual({ allowed: false, reason: "owner_only" })
  })

  it.each([
    ["POST", "/admin/platform-settings/store"],
    ["POST", "/admin/integrations/credentials/paytr/check"],
    ["POST", "/admin/einvoice/parasut/check"],
    ["GET", "/admin/einvoice/parasut"],
    ["GET", "/admin/integrations/credentials"],
    ["GET", "/admin/integrations/overview"],
    ["GET", "/admin/webhooks"],
    ["GET", "/admin/audit-log"],
    ["GET", "/admin/users"],
    ["POST", "/admin/products/prod_1"],
    ["POST", "/admin/orders/order_1/refunds"],
    ["POST", "/admin/some-route-medusa-adds-later"],
  ] as const)("lets an admin %s %s", (method, path) => {
    expect(allowed("admin", method, path)).toBe(true)
  })

  it("lets operations read and run the day, never change the shop's settings (KK1)", () => {
    expect(allowed("operations", "GET", "/admin/orders")).toBe(true)
    expect(allowed("operations", "GET", "/admin/products/prod_1")).toBe(true)
    expect(allowed("operations", "POST", "/admin/orders/order_1/ship")).toBe(true)
    expect(allowed("operations", "POST", "/admin/orders/order_1")).toBe(true)
    expect(
      allowed("operations", "POST", "/admin/orders/order_1/fulfillments/ful_1/mark-as-delivered")
    ).toBe(true)
    expect(allowed("operations", "POST", "/admin/inventory-items/location-levels/batch")).toBe(true)
    expect(allowed("operations", "POST", "/admin/return-requests/rr_1/receive")).toBe(true)
    expect(allowed("operations", "POST", "/admin/product-reviews/moderate")).toBe(true)

    for (const path of [
      "/admin/platform-settings/store",
      "/admin/platform-settings/seo",
      "/admin/features/content.ai_drafts",
      "/admin/stores/store_1",
      "/admin/products/prod_1",
      "/admin/orders/order_1/refunds",
      "/admin/orders/order_1/cancel",
      "/admin/orders/order_1/bank-transfer/confirm",
      "/admin/return-requests/rr_1/refund",
      "/admin/some-route-medusa-adds-later",
    ]) {
      expect(decide("operations", "POST", path)).toEqual({ allowed: false, reason: "unlisted" })
    }
  })

  it.each([
    ["GET", "/admin/audit-log"],
    ["GET", "/admin/integrations/credentials"],
    ["GET", "/admin/einvoice/parasut"],
    ["GET", "/admin/integrations/overview"],
    ["GET", "/admin/webhooks"],
    ["GET", "/admin/users"],
    ["GET", "/admin/users/user_1"],
    ["GET", "/admin/staff"],
    ["GET", "/admin/workflows-executions"],
    ["GET", "/admin/staff/%6d%65mbers"],
    ["GET", "/admin/notifications"],
    ["GET", "/admin/notifications/noti_1"],
  ] as const)("keeps %s %s from operations and read-only staff", (method, path) => {
    expect(decide("operations", method, path)).toEqual({ allowed: false, reason: "private" })
    expect(decide("readonly", method, path)).toEqual({ allowed: false, reason: "private" })
  })

  it("lets every role read the team's feed, and only the owner and admin customers' messages", () => {
    for (const role of STAFF_ROLES) {
      expect(allowed(role, "GET", "/admin/notifications", { notificationChannel: "feed" })).toBe(
        true
      )
    }
    expect(allowed("admin", "GET", "/admin/notifications", { notificationChannel: "email" })).toBe(
      true
    )
    expect(
      allowed("operations", "GET", "/admin/notifications", { notificationChannel: "email" })
    ).toBe(false)
  })

  it("lets every role read who it is", () => {
    for (const role of STAFF_ROLES) {
      expect(allowed(role, "GET", "/admin/users/me")).toBe(true)
      expect(allowed(role, "GET", "/admin/staff/me")).toBe(true)
    }
  })

  it("lets read-only staff read and export, nothing more", () => {
    expect(allowed("readonly", "GET", "/admin/reports/sales")).toBe(true)
    expect(allowed("readonly", "HEAD", "/admin/orders")).toBe(true)
    expect(allowed("readonly", "POST", "/admin/orders/order_1/ship")).toBe(false)
    expect(allowed("readonly", "POST", "/admin/async-jobs", { jobType: "report.export" })).toBe(
      true
    )
    expect(allowed("readonly", "POST", "/admin/async-jobs", { jobType: "catalog.import" })).toBe(
      false
    )
    expect(allowed("readonly", "POST", "/admin/async-jobs")).toBe(false)
    expect(
      allowed("operations", "POST", "/admin/async-jobs", { jobType: "accounting.package" })
    ).toBe(false)
  })

  it("tells the panel what each role may do, as the API decides it", () => {
    expect(capabilitiesOf("owner")).toEqual({
      settings: true,
      catalog: true,
      marketing: true,
      orders: true,
      money: true,
      stock: true,
      moderation: true,
      accounts: true,
      keys: true,
      security: true,
      maintenance: true,
      team: true,
      staff: true,
      audit: true,
      taxId: true,
      privacy: true,
      invoices: true,
      migration: true,
      fraud: true,
      bulkMessages: true,
      paymentLinks: true,
      paymentLinksManage: true,
      searchSynonyms: true,
      legalTexts: true,
      vatRates: true,
      trAddressSync: true,
    })
    expect(capabilitiesOf("admin")).toMatchObject({
      settings: true,
      accounts: false,
      keys: false,
      security: false,
      maintenance: false,
      team: true,
      staff: false,
      audit: true,
      taxId: true,
      privacy: true,
      invoices: true,
      migration: false,
      fraud: true,
      bulkMessages: true,
      paymentLinks: true,
      paymentLinksManage: true,
      searchSynonyms: true,
      legalTexts: true,
      vatRates: false,
      trAddressSync: false,
    })
    expect(capabilitiesOf("operations")).toEqual({
      settings: false,
      catalog: false,
      marketing: false,
      orders: true,
      money: false,
      stock: true,
      moderation: true,
      accounts: false,
      keys: false,
      security: false,
      maintenance: false,
      team: false,
      staff: false,
      audit: false,
      taxId: false,
      privacy: false,
      invoices: false,
      migration: false,
      fraud: false,
      bulkMessages: false,
      paymentLinks: true,
      paymentLinksManage: false,
      searchSynonyms: false,
      legalTexts: false,
      vatRates: false,
      trAddressSync: false,
    })
    expect(Object.values(capabilitiesOf("readonly")).every((can) => !can)).toBe(true)
    expect(Object.values(capabilitiesOf(null)).every((can) => !can)).toBe(true)
  })

  it("decides site search's synonym writes as the searchSynonyms capability says; every role reads", () => {
    for (const role of STAFF_ROLES) {
      const can = capabilitiesOf(role).searchSynonyms
      expect(can).toBe(role === "owner" || role === "admin")
      for (const [method, path] of [
        ["POST", "/admin/search/synonyms"],
        ["POST", "/admin/search/synonyms/ssyn_1"],
        ["DELETE", "/admin/search/synonyms/ssyn_1"],
      ] as const) {
        expect(allowed(role, method, path)).toBe(can)
      }
      expect(allowed(role, "GET", "/admin/search/synonyms")).toBe(true)
      expect(allowed(role, "GET", "/admin/search/index")).toBe(true)
    }
  })

  it("decides the legal texts' writes as the legalTexts capability says; every role reads", () => {
    for (const role of STAFF_ROLES) {
      const can = capabilitiesOf(role).legalTexts
      expect(can).toBe(role === "owner" || role === "admin")
      for (const [method, path] of [
        ["POST", "/admin/legal-documents/return_policy/draft"],
        ["DELETE", "/admin/legal-documents/return_policy/draft"],
        ["POST", "/admin/legal-documents/return_policy/draft/reset"],
        ["POST", "/admin/legal-documents/return_policy/publish"],
        ["POST", "/admin/legal-documents/return_policy/preview"],
      ] as const) {
        expect(allowed(role, method, path)).toBe(can)
      }
      expect(allowed(role, "GET", "/admin/legal-documents/return_policy")).toBe(true)
      expect(allowed(role, "GET", "/admin/legal-documents/return_policy/starter")).toBe(true)
    }
  })

  it("decides the KDV rates' writes as the vatRates capability says: the owner's; every role reads", () => {
    for (const role of STAFF_ROLES) {
      const can = capabilitiesOf(role).vatRates
      expect(can).toBe(role === "owner")
      for (const [method, path] of [
        ["POST", "/admin/vat-rates"],
        ["POST", "/admin/vat-rates/txr_1"],
        ["POST", "/admin/vat-rates/default"],
      ] as const) {
        expect(allowed(role, method, path)).toBe(can)
      }
      expect(allowed(role, "GET", "/admin/vat-rates")).toBe(true)
      // Medusa's own lists stay readable; the panel reads the rates from ours
      expect(allowed(role, "GET", "/admin/product-types")).toBe(true)
    }
  })

  it("leaves the address data's sync to the owner (trAddressSync); every role reads its state", () => {
    for (const role of STAFF_ROLES) {
      const can = capabilitiesOf(role).trAddressSync
      expect(can).toBe(role === "owner")
      expect(allowed(role, "POST", "/admin/tr-address/sync")).toBe(can)
      expect(allowed(role, "GET", "/admin/tr-address/status")).toBe(true)
    }
  })
})

/**
 * Every write route of ours, with whether `operations` may call it. A new
 * route fails this test until its line is added: the role table is
 * decided for it, not left to the default.
 */
const OPERATIONS_WRITE_ROUTES: Record<string, boolean> = {
  "POST /admin/accounting/syncs/:id/retry": false,
  "POST /admin/api-access/:id/revoke": false,
  "POST /admin/api-access": false,
  "POST /admin/async-jobs": false,
  "POST /admin/async-jobs/:id/cancel": true,
  "POST /admin/attribute-templates/:id": false,
  "DELETE /admin/attribute-templates/:id": false,
  "POST /admin/attribute-templates": false,
  "POST /admin/brands/:id": false,
  "DELETE /admin/brands/:id": false,
  "POST /admin/brands": false,
  // adr/0056: search synonyms are the owner's and admins' (the searchSynonyms capability)
  "POST /admin/search/synonyms/:id": false,
  "DELETE /admin/search/synonyms/:id": false,
  "POST /admin/search/synonyms": false,
  "POST /admin/catalog/imports": false,
  "POST /admin/migrations": false,
  "POST /admin/migrations/shopify": false,
  "POST /admin/migrations/feed": false,
  "POST /admin/migrations/customers": false,
  "POST /admin/migrations/:id/restart": false,
  "POST /admin/migrations/urls/:id/decision": false,
  "POST /admin/migrations/urls/apply": false,
  "POST /admin/migrations/cutover": false,
  "POST /admin/migrations/invites": false,
  "POST /admin/migrations/urls/sitemap": false,
  "POST /admin/migrations/urls/search-console": false,
  // A held order's release, and who the shop turns away: owner and admin (adr/0044)
  "POST /admin/fraud/reviews/:id/decision": false,
  "POST /admin/fraud/blocks": false,
  "DELETE /admin/fraud/blocks/:id": false,
  "POST /admin/chargebacks/:id": false,
  "POST /admin/chargebacks": false,
  "POST /admin/content-drafts/:id/approve": false,
  "POST /admin/content-drafts/:id/reject": false,
  "POST /admin/content-drafts": false,
  "POST /admin/content/:id": false,
  "DELETE /admin/content/:id": false,
  "POST /admin/content": false,
  // A blog's categories and tags (adr/0019 ek 2026-11-03): the catalogue's people
  "POST /admin/content/terms": false,
  "POST /admin/content/terms/:id": false,
  "DELETE /admin/content/terms/:id": false,
  "POST /admin/customer-segments/:id/refresh": false,
  "POST /admin/customer-segments/:id": false,
  "DELETE /admin/customer-segments/:id": false,
  "POST /admin/customer-segments": false,
  // adr/0050: bulk messages are written and sent by the owner and admin only
  "POST /admin/bulk-messages": false,
  "POST /admin/bulk-messages/:id": false,
  "DELETE /admin/bulk-messages/:id": false,
  "POST /admin/bulk-messages/:id/audience-preview": false,
  "POST /admin/bulk-messages/:id/test-send": false,
  "POST /admin/bulk-messages/:id/schedule": false,
  "POST /admin/bulk-messages/:id/send": false,
  "POST /admin/bulk-messages/:id/pause": false,
  "POST /admin/bulk-messages/:id/resume": false,
  "POST /admin/bulk-messages/:id/cancel": false,
  "POST /admin/bulk-messages/:id/copy": false,
  "POST /admin/customers/:id/consents": false,
  "POST /admin/customers/:id/billing-profile/reveal": false,
  "POST /admin/features/:key": false,
  "POST /admin/google/connect": false,
  "POST /admin/google/merchant": false,
  "POST /admin/google/merchant/sync": false,
  "DELETE /admin/google": false,
  "POST /admin/google/search-console": false,
  "POST /admin/integrations/credentials/:provider/check": false,
  "POST /admin/integrations/credentials/:provider": false,
  "DELETE /admin/integrations/credentials/:provider": false,
  // adr/0053: a link past the maintenance page, as a draft's preview link
  "POST /admin/maintenance/bypass": false,
  "POST /admin/legal-documents/:kind/draft": false,
  "DELETE /admin/legal-documents/:kind/draft": false,
  "POST /admin/legal-documents/:kind/draft/reset": false,
  "POST /admin/legal-documents/:kind/publish": false,
  "POST /admin/legal-documents/:kind/preview": false,
  "POST /admin/landings/:id": false,
  "DELETE /admin/landings/:id": false,
  "POST /admin/landings": false,
  "POST /admin/marketing-feeds/generate": false,
  "POST /admin/marketing-feeds/token": false,
  "DELETE /admin/marketing-feeds/token": false,
  "POST /admin/media/:id": false,
  "DELETE /admin/media/:id": false,
  "POST /admin/media/import": false,
  "POST /admin/media": false,
  "POST /admin/messaging/sender-domain/check": false,
  "POST /admin/messaging/sender-domain": false,
  "DELETE /admin/messaging/sender-domain": false,
  "DELETE /admin/messaging/suppressions/:id": false,
  "POST /admin/messaging/suppressions": false,
  "POST /admin/order-board/ship": true,
  "POST /admin/order-board/deliver": true,
  "POST /admin/orders/:id/return-requests": true,
  "POST /admin/orders/:id/notes": true,
  "DELETE /admin/orders/:id/notes/:note_id": true,
  "POST /admin/orders/:id/bank-transfer/confirm": false,
  "POST /admin/orders/:id/edit/preview": false,
  "POST /admin/orders/:id/edit": false,
  "POST /admin/orders/:id/refunds/preview": false,
  "POST /admin/orders/:id/refunds": false,
  "POST /admin/orders/:id/ship": true,
  "POST /admin/platform-settings/:section": false,
  "POST /admin/price-lists/:id/discount": false,
  "POST /admin/product-answers/moderate": true,
  "POST /admin/product-questions/:id/answer": true,
  // adr/0047: answering the contact form is the day's work; deleting a message is not
  "POST /admin/contact-messages/:id": true,
  // F18: a draft's preview link, with the content it previews
  "POST /admin/content/:id/preview": false,
  "DELETE /admin/contact-messages/:id": false,
  "POST /admin/product-questions/moderate": true,
  "POST /admin/product-reviews/moderate": true,
  "POST /admin/products/:id/attributes": false,
  "POST /admin/products/:id/brand": false,
  "POST /admin/products/:id/catalog": false,
  "POST /admin/category-restrictions/:category_id": false,
  "POST /admin/customers/:id/privacy-requests": false,
  "POST /admin/privacy-requests/:id/export": false,
  "POST /admin/privacy-requests/:id/close": false,
  "POST /admin/privacy-requests/:id/erase": false,
  "POST /admin/promotions/:id/code-batches/:campaign_id/revoke": false,
  "POST /admin/promotions/:id/offer": false,
  "POST /admin/reports/statements": false,
  "POST /admin/return-requests/:id/approve": true,
  "POST /admin/return-requests/:id/receive": true,
  "POST /admin/return-requests/:id/refund": false,
  "POST /admin/return-requests/:id/reject": true,
  "PUT /admin/seo/:entity_type/:entity_id": false,
  "POST /admin/seo/assessments/:kind/:id/fix": false,
  "POST /admin/seo/insights/refresh": false,
  "DELETE /admin/seo/not-found/:id": false,
  "POST /admin/seo/old-paths/release": false,
  "POST /admin/seo/redirect-file": false,
  "POST /admin/seo/redirects/:id": false,
  "DELETE /admin/seo/redirects/:id": false,
  "POST /admin/seo/redirects": false,
  "POST /admin/shipping-setup/options/:id": false,
  "DELETE /admin/shipping-setup/options/:id": false,
  "POST /admin/shipping-setup/options": false,
  "POST /admin/staff/invites/:id/resend": false,
  "DELETE /admin/staff/invites/:id": false,
  "POST /admin/staff/invites/accept": false,
  // Read-only, before an account exists: no session, so no role decides it
  "POST /admin/staff/invites/info": false,
  "POST /admin/staff/invites": false,
  "POST /admin/staff/members/:id": false,
  "DELETE /admin/staff/members/:id": false,
  "POST /admin/staff/members/:id/reset-mfa": false,
  "POST /admin/stock-items/:id/watch": true,
  "POST /admin/warehouses/:id/default": false,
  "POST /admin/warehouses/:id": false,
  "POST /admin/warehouses": false,
  "POST /admin/webhooks/:id": false,
  "POST /admin/webhooks/:id/rotate-secret": false,
  "DELETE /admin/webhooks/:id": false,
  "POST /admin/webhooks": false,
  "POST /admin/einvoice/parasut": false,
  "DELETE /admin/einvoice/parasut": false,
  "POST /admin/einvoice/parasut/check": false,
  // adr/0051 §8: operations make a link without a discount and send it; the rest is the admin's
  "POST /admin/payment-links": true,
  "POST /admin/payment-links/preview": true,
  "POST /admin/payment-links/:id/resend": true,
  "POST /admin/payment-links/:id/cancel": false,
  "POST /admin/payment-links/:id/extend": false,
  "POST /admin/invoices/:id/issued": false,
  "POST /admin/invoices/:id/pdf": false,
  "POST /admin/invoices/:id/retry": false,
  "POST /admin/invoices/:id/return-document": false,
  "POST /admin/invoices/:id/waive": false,
  // The storefront's design and menus (adr/0049): the admin's and the owner's
  "POST /admin/storefront-layout": false,
  "POST /admin/storefront-layout/discard": false,
  "POST /admin/storefront-layout/preview": false,
  "POST /admin/storefront-layout/publish": false,
  "POST /admin/storefront-layout/revisions/:revision/restore": false,
  // adr/0007 Ek 2026-11-04: the KDV rates, the owner's
  "POST /admin/vat-rates": false,
  "POST /admin/vat-rates/:id": false,
  "POST /admin/vat-rates/default": false,
  // adr/0008 Ek 2026-11-04: the address data's TürkiyeAPI sync, the owner's
  "POST /admin/tr-address/sync": false,
  "POST /admin/storefront-menus": false,
  "POST /admin/storefront-menus/:id": false,
  "DELETE /admin/storefront-menus/:id": false,
}

const ADMIN_DIR = join(__dirname, "../../../api/admin")
const HANDLER = /^export (?:async function|function|const|let) (POST|PUT|PATCH|DELETE)\b/gm

function routeFiles(dir: string): string[] {
  return readdirSync(dir).flatMap((name) => {
    const path = join(dir, name)
    if (statSync(path).isDirectory()) {
      return routeFiles(path)
    }
    return name === "route.ts" ? [path] : []
  })
}

describe("every write route of ours has a decision for operations", () => {
  const found = routeFiles(ADMIN_DIR).flatMap((file) => {
    const path = `/admin/${relative(ADMIN_DIR, join(file, ".."))}`.replace(/\[(\w+)\]/g, ":$1")
    return [...readFileSync(file, "utf8").matchAll(HANDLER)].map(
      ([, method = ""]) => `${method} ${path}`
    )
  })

  it("lists them all", () => {
    expect(found.filter((route) => !(route in OPERATIONS_WRITE_ROUTES))).toEqual([])
  })

  it.each(Object.entries(OPERATIONS_WRITE_ROUTES))("%s → %s", (route, expected) => {
    const [method = "", path = ""] = route.split(" ")
    const sample = path.replace(/:\w+/g, "x1")
    expect(allowed("operations", method, sample)).toBe(expected)
  })
})
