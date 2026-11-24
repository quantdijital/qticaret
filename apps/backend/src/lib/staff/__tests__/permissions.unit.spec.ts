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
    ["DELETE", "/admin/api-keys/apk_1"],
    ["DELETE", "/admin/api-keys/apk%5F1"],
  ] as const)(
    "keeps Medusa's %s %s from everyone: our own routes do it with their guards",
    (method, path) => {
      for (const role of STAFF_ROLES) {
        expect(decide(role, method, path)).toEqual({ allowed: false, reason: "replaced" })
      }
    }
  )

  it("deletes a secret key only through /admin/api-access, a publishable one through Medusa", () => {
    const path = "/admin/api-keys/apk_1"
    for (const role of STAFF_ROLES) {
      expect(decide(role, "DELETE", path, { apiKeyType: "secret" })).toEqual({
        allowed: false,
        reason: "replaced",
      })
    }
    expect(decide("owner", "DELETE", path, { apiKeyType: "publishable" })).toEqual({
      allowed: true,
      reason: "owner",
    })
    // Still the owner's alone
    expect(allowed("admin", "DELETE", path, { apiKeyType: "publishable" })).toBe(false)
    // Revoking and renaming stay Medusa's
    expect(allowed("owner", "POST", "/admin/api-keys/apk_1/revoke")).toBe(true)
  })

  it("leaves Medusa's invitation acceptance to the invited", () => {
    expect(allowed("owner", "POST", "/admin/invites/accept")).toBe(true)
  })

  it.each([
    ["POST", "/admin/integrations/credentials/paytr"],
    ["DELETE", "/admin/integrations/credentials/iyzico"],
    // adr/0071 §6: connecting, replacing and removing an AI service key
    ["POST", "/admin/integrations/credentials/deepseek"],
    ["POST", "/admin/integrations/credentials/gemini"],
    ["DELETE", "/admin/integrations/credentials/minimax"],
    ["GET", "/admin/api-access"],
    ["POST", "/admin/api-access/key_1/revoke"],
    ["DELETE", "/admin/api-access/key_1"],
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
    ["POST", "/admin/einvoice/birfatura/token"],
    ["POST", "/admin/einvoice/%62irfatura/token"],
    ["POST", "/admin/features/ai.reviews"],
    ["POST", "/admin/features/ai%2ereviews"],
    ["POST", "/admin/features/ai.assistant"],
    ["POST", "/admin/google/connect"],
    ["POST", "/admin/google/reviews/connect"],
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
    // The storefront's looks, read too (the owner, 2026-11-23), in every spelling Express runs
    ["GET", "/admin/storefront-designs"],
    ["GET", "/admin/storefront%2ddesigns"],
    ["GET", "/admin/Storefront-Designs/"],
    ["POST", "/admin/storefront-designs/sfd_1/apply"],
    ["POST", "/admin/storefront-designs/sfd%5f1/apply"],
    ["DELETE", "/admin/STOREFRONT-DESIGNS/sfd_1"],
    ["GET", "/admin/storefront-presets"],
    ["GET", "/admin/storefront%2Dpresets/general/sade/preview"],
    ["POST", "/admin/storefront-presets/general/sade/apply"],
    ["POST", "/admin/Storefront-Presets/general/sade/apply"],
  ] as const)("keeps %s %s the owner's alone", (method, path) => {
    expect(decide("admin", method, path)).toEqual({ allowed: false, reason: "owner_only" })
  })

  it.each([
    ["POST", "/admin/platform-settings/store"],
    ["POST", "/admin/integrations/credentials/paytr/check"],
    ["POST", "/admin/integrations/credentials/deepseek/check"],
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

  it("lets every role use the assistant; only the owner turns it on (adr/0079 §8)", () => {
    for (const role of STAFF_ROLES) {
      expect(allowed(role, "POST", "/admin/ai/assistant/turns")).toBe(true)
      expect(allowed(role, "GET", "/admin/ai/assistant/conversations/aiconv_1")).toBe(true)
      expect(allowed(role, "DELETE", "/admin/ai/assistant/conversations/aiconv_1")).toBe(true)
      expect(allowed(role, "POST", "/admin/features/ai.assistant")).toBe(role === "owner")
    }
  })

  it("keeps AI service keys from operations and readonly, checks included (adr/0071 §6)", () => {
    for (const role of ["operations", "readonly"] as const) {
      for (const [method, path] of [
        ["POST", "/admin/integrations/credentials/deepseek"],
        ["POST", "/admin/integrations/credentials/gemini/check"],
        ["DELETE", "/admin/integrations/credentials/minimax"],
        ["GET", "/admin/integrations/credentials"],
      ] as const) {
        expect(allowed(role, method, path)).toBe(false)
      }
    }
  })

  it("decides the AI core's routes as adr/0071 §6's table says", () => {
    const routes = [
      ["GET", "/admin/ai/services"],
      ["POST", "/admin/ai/suggestions"],
      ["POST", "/admin/ai/suggestions/cdraft_1/accept"],
      ["POST", "/admin/ai/suggestions/cdraft_1/dismiss"],
      ["GET", "/admin/ai/usage"],
      ["GET", "/admin/ai/suggestions"],
      // adr/0074: "Dene" with the guidance not saved, and the acceptance rate
      ["POST", "/admin/ai/guidance/preview"],
      ["GET", "/admin/ai/acceptance"],
    ] as const
    const table = (role: "owner" | "admin" | "operations" | "readonly") =>
      routes.map(([method, path]) => allowed(role, method, path))

    expect(table("owner")).toEqual([true, true, true, true, true, true, true, true])
    expect(table("admin")).toEqual([true, true, true, true, true, true, true, true])
    // Aşama 9: a decision is checked in the workflow against the suggestion's own task
    expect(table("operations")).toEqual([true, false, true, true, false, false, false, false])
    expect(table("readonly")).toEqual([true, false, false, false, false, false, false, false])
  })

  it("keeps the bulk SEO fill the owner's and admin's (adr/0074 §5 madde 7)", () => {
    for (const [method, path] of [
      ["GET", "/admin/ai/seo-fill"],
      ["POST", "/admin/ai/seo-fill"],
      ["GET", "/admin/ai/seo-fill/suggestions"],
    ] as const) {
      expect(allowed("owner", method, path)).toBe(true)
      expect(allowed("admin", method, path)).toBe(true)
      expect(allowed("operations", method, path)).toBe(false)
      expect(allowed("readonly", method, path)).toBe(false)
    }
  })

  it("opens to operations only the AI tasks on reviews and questions (Aşama 9)", () => {
    const ask = (role: "operations" | "readonly", aiTask?: string) =>
      allowed(role, "POST", "/admin/ai/suggestions", { aiTask })
    for (const task of ["review_summary", "review_reply", "question_answer"]) {
      expect(ask("operations", task)).toBe(true)
      expect(ask("readonly", task)).toBe(false)
    }
    for (const task of [
      "seo_title",
      "seo_description",
      "product_description",
      "image_alt_text",
      "image_background",
      "focus_keyword",
      "product_title",
      "short_description",
      "product_tags",
      "product_category",
      "product_attributes",
      "product_faq",
      "post_draft",
      "test_text",
      "no_such_task",
      "__proto__",
    ]) {
      expect(ask("operations", task)).toBe(false)
    }
    expect(ask("operations")).toBe(false)
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
      "/admin/features/stock.preorder",
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
    ["GET", "/admin/einvoice/birfatura"],
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

  it("lets every role read the team's alerts and mark its own read; Medusa's feed is the owner's and admin's", () => {
    for (const role of STAFF_ROLES) {
      expect(allowed(role, "GET", "/admin/alerts")).toBe(true)
      expect(decide(role, "POST", "/admin/alerts/read")).toEqual({ allowed: true, reason: "own" })
    }
    expect(allowed("admin", "GET", "/admin/notifications")).toBe(true)
    expect(allowed("operations", "GET", "/admin/notifications")).toBe(false)
    expect(allowed("readonly", "GET", "/admin/notifications")).toBe(false)
  })

  it("lets every role read and change its own account, never another's", () => {
    for (const role of STAFF_ROLES) {
      expect(allowed(role, "GET", "/admin/staff/me/sessions")).toBe(true)
      expect(decide(role, "GET", "/admin/staff/me/profile")).toEqual({
        allowed: true,
        reason: "own",
      })
      for (const path of [
        "/admin/staff/me/profile",
        "/admin/staff/me/password",
        "/admin/staff/me/email",
        "/admin/staff/me/email/cancel",
        "/admin/staff/me/email/confirm",
        "/admin/staff/me/sessions/end-others",
      ]) {
        expect(allowed(role, "POST", path)).toBe(true)
      }
      // Its own list, not a way round the team's rules
      expect(allowed(role, "DELETE", "/admin/staff/me/profile")).toBe(role === "owner")
      expect(allowed(role, "POST", "/admin/staff/members/user_1")).toBe(role === "owner")
      expect(allowed(role, "POST", "/admin/users/user_1")).toBe(role === "owner")
    }
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
      travelerDocuments: true,
      travelerRequests: true,
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
      orderExport: true,
      customers: true,
      abandonedCarts: true,
      resendMessages: true,
      looks: true,
      wholesale: true,
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
      travelerDocuments: true,
      travelerRequests: true,
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
      orderExport: false,
      looks: false,
      wholesale: true,
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
      travelerDocuments: false,
      travelerRequests: false,
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
      orderExport: false,
      customers: true,
      abandonedCarts: true,
      resendMessages: true,
      looks: false,
      wholesale: false,
    })
    expect(Object.values(capabilitiesOf("readonly")).every((can) => !can)).toBe(true)
    expect(Object.values(capabilitiesOf(null)).every((can) => !can)).toBe(true)
  })

  it("lets operations edit customers, follow up carts and resend messages; read-only staff do none", () => {
    const writes = [
      ["POST", "/admin/customers"],
      ["POST", "/admin/customers/cus_1"],
      ["POST", "/admin/customers/cus_1/note"],
      ["POST", "/admin/customers/cus_1/addresses"],
      ["POST", "/admin/customers/cus_1/addresses/cuaddr_1"],
      ["DELETE", "/admin/customers/cus_1/addresses/cuaddr_1"],
      ["POST", "/admin/orders/order_1/messages/noti_1/resend"],
      ["POST", "/admin/abandoned-carts/cart_1/remind"],
    ] as const
    for (const role of STAFF_ROLES) {
      for (const [method, path] of writes) {
        expect(allowed(role, method, path)).toBe(role !== "readonly")
      }
      // The carts left behind name people who did not buy: not for read-only staff
      expect(allowed(role, "GET", "/admin/abandoned-carts")).toBe(role !== "readonly")
      expect(allowed(role, "GET", "/admin/abandoned-carts/cart_1")).toBe(role !== "readonly")
      expect(allowed(role, "GET", "/admin/customers/cus_1")).toBe(true)
    }
    // Consent is the person's, recorded by owner and admin only; erasure stays a KVKK request's
    expect(allowed("operations", "POST", "/admin/customers/cus_1/consents")).toBe(false)
    expect(allowed("operations", "DELETE", "/admin/customers/cus_1")).toBe(false)
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

  it("keeps the storefront's looks, read or written, the owner's alone (adr/0064, 2026-11-23)", () => {
    for (const role of STAFF_ROLES) {
      const can = capabilitiesOf(role).looks
      expect(can).toBe(role === "owner")
      for (const [method, path] of [
        ["GET", "/admin/storefront-designs"],
        ["POST", "/admin/storefront-designs"],
        ["POST", "/admin/storefront-designs/sfd_1"],
        ["DELETE", "/admin/storefront-designs/sfd_1"],
        ["POST", "/admin/storefront-designs/sfd_1/apply"],
        ["GET", "/admin/storefront-presets"],
        ["GET", "/admin/storefront-presets/cutlery/katalog/preview"],
        ["POST", "/admin/storefront-presets/cutlery/katalog/apply"],
        // Encoded, as Express decodes the segments
        ["POST", "/admin/storefront%2Ddesigns/sfd_1/apply"],
      ] as const) {
        expect({ role, method, path, allowed: allowed(role, method, path) }).toEqual({
          role,
          method,
          path,
          allowed: can,
        })
      }
      // The theme editor itself is not a look: its draft, publish and history stay as they were
      expect(allowed(role, "GET", "/admin/storefront-layout")).toBe(true)
      expect(allowed(role, "POST", "/admin/storefront-layout/revisions/3/restore")).toBe(
        role === "owner" || role === "admin"
      )
    }
  })

  it("lets only the owner and admin read or write wholesale levels and prices (ADR-0068 §9)", () => {
    for (const role of STAFF_ROLES) {
      const can = role === "owner" || role === "admin"
      for (const [method, path] of [
        ["GET", "/admin/wholesale/tiers"],
        ["GET", "/admin/wholesale/tiers/wtier_1/lines"],
        ["POST", "/admin/wholesale/tiers"],
        ["POST", "/admin/wholesale/tiers/wtier_1/prices"],
        ["DELETE", "/admin/wholesale/tiers/wtier_1"],
        // Slice 1b: wholesalers, read too (decision 17)
        ["GET", "/admin/wholesale/accounts"],
        ["GET", "/admin/wholesale/accounts/wacc_1"],
        ["GET", "/admin/wholesale/accounts/wacc_1/lines"],
        ["POST", "/admin/wholesale/accounts"],
        ["POST", "/admin/wholesale/accounts/wacc_1/deactivate"],
        ["POST", "/admin/wholesale/accounts/wacc_1/password"],
        ["POST", "/admin/wholesale/accounts/wacc_1/prices"],
        ["DELETE", "/admin/wholesale/accounts/wacc_1"],
      ] as const) {
        expect({ role, method, path, allowed: allowed(role, method, path) }).toEqual({
          role,
          method,
          path,
          allowed: can,
        })
      }
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
  // One's own read alerts (adr/0020)
  "POST /admin/alerts/read": true,
  "POST /admin/api-access/:id/revoke": false,
  "DELETE /admin/api-access/:id": false,
  "POST /admin/api-access": false,
  "POST /admin/async-jobs": false,
  "POST /admin/async-jobs/:id/cancel": true,
  "POST /admin/attribute-templates/:id": false,
  "DELETE /admin/attribute-templates/:id": false,
  "POST /admin/attribute-templates/:id/definitions/:definition_id/convert": false,
  "POST /admin/attribute-templates": false,
  // adr/0052 Ek 2026-11-23: add-on templates are catalog writes, as a product's add-ons
  "POST /admin/addon-templates/:id": false,
  "DELETE /admin/addon-templates/:id": false,
  "POST /admin/addon-templates": false,
  "POST /admin/attribute-templates/:id/addon-templates": false,
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
  // adr/0071 §6: AI suggestions; operations gets only its own area's tasks (Aşama 9): an ask
  // names its task (none named here: refused), a decision is checked against the suggestion's
  "POST /admin/ai/suggestions": false,
  "POST /admin/ai/suggestions/:id/accept": true,
  "POST /admin/ai/suggestions/:id/dismiss": true,
  // A product FAQ added as the shop's questions: the task is owner and admin's (adr/0074 §5 madde 4)
  "POST /admin/ai/suggestions/:id/faq": false,
  "POST /admin/ai/guidance/preview": false,
  // The bulk SEO fill: the search text tasks are owner and admin's (adr/0074 §5 madde 7)
  "POST /admin/ai/seo-fill": false,
  // adr/0079 §8: the panel assistant, every role; its tools are narrowed by role
  "POST /admin/ai/assistant/turns": true,
  "DELETE /admin/ai/assistant/conversations/:id": true,
  "POST /admin/content/:id": false,
  "DELETE /admin/content/:id": false,
  "POST /admin/content": false,
  // A blog's categories and tags (adr/0019 ek 2026-11-03): the catalogue's people
  "POST /admin/content/terms": false,
  "POST /admin/content/terms/:id": false,
  "DELETE /admin/content/terms/:id": false,
  // A blog's authors (adr/0060): as its categories and tags
  "POST /admin/content/authors": false,
  "POST /admin/content/authors/:id": false,
  "DELETE /admin/content/authors/:id": false,
  "POST /admin/customer-segments/:id/refresh": false,
  "POST /admin/customer-segments/:id": false,
  "DELETE /admin/customer-segments/:id": false,
  "POST /admin/customer-segments": false,
  // ADR-0068 §9: wholesale is the owner's and admin's, read too
  "POST /admin/wholesale/tiers": false,
  "POST /admin/wholesale/tiers/:id": false,
  "DELETE /admin/wholesale/tiers/:id": false,
  "POST /admin/wholesale/tiers/:id/prices": false,
  "POST /admin/wholesale/accounts": false,
  "POST /admin/wholesale/accounts/:id": false,
  "DELETE /admin/wholesale/accounts/:id": false,
  "POST /admin/wholesale/accounts/:id/deactivate": false,
  "POST /admin/wholesale/accounts/:id/reactivate": false,
  "POST /admin/wholesale/accounts/:id/password": false,
  "POST /admin/wholesale/accounts/:id/prices": false,
  // adr/0050: bulk messages are written and sent by the owner and admin only
  // adr/0080: pop-ups are marketing, as promotions: owner and admin
  "POST /admin/popups": false,
  "POST /admin/popups/:id": false,
  "DELETE /admin/popups/:id": false,
  "POST /admin/popups/:id/status": false,
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
  // 2026-11-06: the team's note on a customer, an order's message again, a cart reminded
  "POST /admin/customers/:id/note": true,
  "POST /admin/orders/:id/messages/:message_id/resend": true,
  "POST /admin/abandoned-carts/:id/remind": true,
  "POST /admin/features/:key": false,
  "POST /admin/google/connect": false,
  "POST /admin/google/merchant": false,
  "POST /admin/google/merchant/sync": false,
  "DELETE /admin/google": false,
  "POST /admin/google/search-console": false,
  // adr/0058: the shop's Google reviews set up by the admin; a review hidden by moderation
  "POST /admin/google/reviews/connect": false,
  "POST /admin/google/reviews/location": false,
  "POST /admin/google/reviews/sync": false,
  "DELETE /admin/google/reviews": false,
  "POST /admin/google/reviews/items/:id": true,
  // The shop's reply to a Google review, as a product question's answer (adr/0058 Ek 2026-11-06)
  "POST /admin/google/reviews/items/:id/reply": true,
  "DELETE /admin/google/reviews/items/:id/reply": true,
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
  // adr/0036 Ek 2026-11-10: a test e-mail through the shop's own mail server, owner and admin
  "POST /admin/messaging/smtp/test": false,
  // adr/0036 Ek 2026-11-10: the customer messages' words, owner and admin
  "POST /admin/messaging/customer-messages/:name": false,
  "POST /admin/messaging/templates/:name/preview": false,
  "POST /admin/order-board/ship": true,
  "POST /admin/order-board/deliver": true,
  // The order list as a file, every customer's details in it: the owner's alone
  "POST /admin/order-board/export": false,
  "POST /admin/orders/:id/return-requests": true,
  "POST /admin/orders/:id/notes": true,
  "DELETE /admin/orders/:id/notes/:note_id": true,
  "POST /admin/orders/:id/bank-transfer/confirm": false,
  "POST /admin/orders/:id/edit/preview": false,
  "POST /admin/orders/:id/edit": false,
  "POST /admin/orders/:id/refunds/preview": false,
  "POST /admin/orders/:id/refunds": false,
  // adr/0076 Ek D7a: a booking's or a whole departure's cancel gives money back
  "POST /admin/orders/:id/bookings/cancel": false,
  "POST /admin/booking-slots/:id/cancel": false,
  // An open refund settled by hand moves the order's money as a refund does
  "POST /admin/orders/:id/refunds/:reference/settle": false,
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
  // The shop's reply under a review, as a question's answer
  "POST /admin/product-reviews/:id/reply": true,
  "DELETE /admin/product-reviews/:id/reply": true,
  "POST /admin/products/:id/attributes": false,
  "POST /admin/products/:id/addon-templates": false,
  // adr/0013 Ek 2026-11-05: a preview of the facts in descriptions, the catalog roles'
  "POST /admin/description-facts/preview": false,
  "POST /admin/products/:id/brand": false,
  "POST /admin/products/:id/catalog": false,
  // A product's copy is a catalog change; its storefront link mints a draft's preview,
  // which stays the catalog roles' as a content draft's does
  "POST /admin/products/:id/duplicate": false,
  "POST /admin/products/:id/preview": false,
  // adr/0069: a product's videos are written by those who write its images
  "POST /admin/products/:id/videos": false,
  "DELETE /admin/products/:id/videos/:video_id": false,
  "POST /admin/products/:id/videos/:video_id": false,
  "POST /admin/products/:id/videos/:video_id/retry": false,
  "POST /admin/products/:id/videos/youtube": false,
  "POST /admin/category-restrictions/:category_id": false,
  "POST /admin/category-images/:category_id": false,
  // adr/0075: a category's text, as its picture
  "POST /admin/category-descriptions/:category_id": false,
  "POST /admin/collections/:id/details": false,
  "POST /admin/customers/:id/privacy-requests": false,
  "POST /admin/privacy-requests/:id/export": false,
  "POST /admin/privacy-requests/:id/close": false,
  "POST /admin/privacy-requests/:id/erase": false,
  "POST /admin/promotions/:id/code-batches/:campaign_id/revoke": false,
  "POST /admin/promotions/:id/offer": false,
  "POST /admin/reports/statements": false,
  "POST /admin/return-requests/:id/approve": true,
  // An approval taken back before anything came back (order #691): as the decision itself
  "POST /admin/return-requests/:id/cancel": true,
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
  // One's own account, whatever the role (the owner, 2026-11-06)
  "POST /admin/staff/me/profile": true,
  "POST /admin/staff/me/password": true,
  "POST /admin/staff/me/email": true,
  "POST /admin/staff/me/email/cancel": true,
  "POST /admin/staff/me/email/confirm": true,
  "POST /admin/staff/me/sessions/end-others": true,
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
  "POST /admin/einvoice/birfatura/token": false,
  // adr/0051 §8: operations make a link without a discount and send it; the rest is the admin's
  "POST /admin/payment-links": true,
  "POST /admin/payment-links/preview": true,
  "POST /admin/payment-links/:id/resend": true,
  "POST /admin/payment-links/:id/cancel": false,
  "POST /admin/payment-links/:id/extend": false,
  "POST /admin/invoices/:id/issued": false,
  "POST /admin/invoices/:id/pdf": false,
  "POST /admin/invoices/:id/retry": false,
  // The stopped invoices picked on the queue, each tried again as one would be
  "POST /admin/invoices/retry": false,
  "POST /admin/invoices/:id/return-document": false,
  "POST /admin/invoices/:id/waive": false,
  // The storefront's design and menus (adr/0049): the admin's and the owner's
  "POST /admin/storefront-layout": false,
  "POST /admin/storefront-layout/discard": false,
  // adr/0065: the theme editor's live preview session, as the editor itself
  "POST /admin/storefront-layout/editor-session": false,
  "PUT /admin/storefront-layout/editor-session/:id": false,
  "DELETE /admin/storefront-layout/editor-session/:id": false,
  "POST /admin/storefront-layout/preview": false,
  "POST /admin/storefront-layout/publish": false,
  "POST /admin/storefront-layout/revisions/:revision/restore": false,
  // adr/0063 §7: a preset into the draft, as a draft's save
  "POST /admin/storefront-presets/:pack/:code/apply": false,
  // adr/0064: the saved looks, as the design's own writes
  "POST /admin/storefront-designs": false,
  "POST /admin/storefront-designs/:id": false,
  "DELETE /admin/storefront-designs/:id": false,
  "POST /admin/storefront-designs/:id/apply": false,
  // adr/0007 Ek 2026-11-04: the KDV rates, the owner's
  "POST /admin/vat-rates": false,
  "POST /admin/vat-rates/:id": false,
  "POST /admin/vat-rates/default": false,
  "POST /admin/storefront-menus": false,
  "POST /admin/storefront-menus/:id": false,
  "DELETE /admin/storefront-menus/:id": false,
  // adr/0076: dated products' settings and departures are the product editors'
  "POST /admin/products/:id/bookable": false,
  "POST /admin/products/:id/booking-slots": false,
  "POST /admin/booking-slots/:id": false,
  // adr/0076 §7: a traveler's full ID number, owner and admin only
  "POST /admin/booking-travelers/:id/reveal": false,
  // adr/0076 Ek D6b: a traveler's own KVKK request, owner and admin only
  "POST /admin/booking-travelers/search": false,
  // adr/0076 Ek D7b: a voucher's code checked at a departure, a read of the order
  "POST /admin/booking-vouchers/check": true,
  "POST /admin/booking-travelers/erase": false,
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
