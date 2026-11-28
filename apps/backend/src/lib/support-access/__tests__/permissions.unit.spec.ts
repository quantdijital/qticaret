import { OWNER_ONLY, PRIVATE } from "../../staff/permission-rules"
import { decideSupport, supportCapabilities } from "../permissions"

const allowed = (method: string, path: string, jobType?: string) =>
  decideSupport(method, path, jobType ? { jobType } : {}).allowed

describe("decideSupport (adr/0061 Ek Destek erişimi, Karar 5)", () => {
  it("reaches what design and product entry need, the owner's looks included", () => {
    expect(allowed("POST", "/admin/products")).toBe(true)
    expect(allowed("POST", "/admin/products/prod_1")).toBe(true)
    expect(allowed("POST", "/admin/storefront-designs/apply")).toBe(true)
    expect(allowed("GET", "/admin/storefront-presets")).toBe(true)
    expect(allowed("POST", "/admin/storefront-layout/draft")).toBe(true)
    expect(allowed("POST", "/admin/platform-settings/theme")).toBe(true)
    expect(allowed("GET", "/admin/orders")).toBe(true)
    expect(allowed("GET", "/admin/staff/me")).toBe(true)
    expect(allowed("GET", "/admin/users/me")).toBe(true)
  })

  it.each([
    // The shop's people, owner and roles; one's own account
    ["POST", "/admin/staff/invites"],
    ["POST", "/admin/staff/members/user_1"],
    ["DELETE", "/admin/staff/members/user_1"],
    ["GET", "/admin/staff"],
    ["POST", "/admin/staff/me/password"],
    ["POST", "/admin/users/user_1"],
    ["POST", "/admin/invites"],
    // Payment and integration secrets
    ["POST", "/admin/integrations/credentials/iyzico"],
    ["GET", "/admin/integrations/credentials"],
    ["POST", "/admin/api-access"],
    ["POST", "/admin/webhooks"],
    ["POST", "/admin/messaging/smtp/test"],
    ["POST", "/admin/einvoice/birfatura"],
    ["POST", "/admin/google/connect"],
    // Money, tax, the legal identity, 2FA and the switch, going dark
    ["POST", "/admin/platform-settings/bank_transfer"],
    ["POST", "/admin/platform-settings/payments"],
    ["POST", "/admin/platform-settings/legal"],
    ["POST", "/admin/platform-settings/security"],
    ["POST", "/admin/platform-settings/maintenance"],
    ["POST", "/admin/platform-settings/bank%5Ftransfer"],
    ["POST", "/admin/vat-rates"],
    ["GET", "/admin/plan"],
    ["POST", "/admin/ai/credits/orders"],
    // Customers' personal data out
    ["POST", "/admin/order-board/export"],
    ["POST", "/admin/customer-export"],
    ["POST", "/admin/customers/cus_1/billing-profile/reveal"],
    ["POST", "/admin/customers/cus_1/privacy-requests"],
    ["GET", "/admin/invoices/inv_1/pdf"],
    ["POST", "/admin/migrations"],
    ["POST", "/admin/features/ai.assistant"],
    // The trail, the switch itself
    ["GET", "/admin/audit-log"],
    ["GET", "/admin/support-access"],
    ["POST", "/admin/support-access/sessions/sgr_x/end"],
    // Medusa's own ways round the role layer
    ["DELETE", "/admin/customers/cus_1"],
    ["POST", "/admin/tax-rates"],
    // Security review M1, M2, H2
    ["POST", "/admin/orders/export"],
    ["GET", "/admin/async-jobs/job_1/result"],
    ["POST", "/admin/platform-settings/notifications"],
    ["POST", "/admin/booking-travelers/erase"],
    ["GET", "/admin/integrations/overview"],
    ["POST", "/admin/orders/order_1/refunds"],
    ["POST", "/admin/payments/pay_1/refund"],
    ["POST", "/admin/gift-cards"],
    ["POST", "/admin/payment-links"],
    ["POST", "/admin/bulk-messages/bm_1/send"],
    ["POST", "/admin/legal-documents/terms/publish"],
    // Security review M-A
    ["POST", "/admin/orders/order_1/bank-transfer/confirm"],
    ["POST", "/admin/payment-collections/paycol_1/mark-as-paid"],
    ["POST", "/admin/draft-orders/order_1/convert-to-order"],
    ["POST", "/admin/wholesale/accounts/wacc_1/password"],
    ["GET", "/admin/wholesale/accounts"],
    ["POST", "/admin/messaging/customer-messages/order.placed"],
    ["POST", "/admin/platform-settings/store"],
    ["POST", "/admin/platform-settings/notifications"],
    ["POST", "/admin/promotions"],
    ["POST", "/admin/promotions/promo_1"],
    ["GET", "/admin/fraud/blocks"],
    ["POST", "/admin/fraud/blocks"],
    // Security review M-B: not on the allow-list
    ["POST", "/admin/orders/order_1"],
    ["POST", "/admin/orders/order_1/cancel"],
    ["POST", "/admin/customers/cus_1"],
    ["POST", "/admin/customers"],
    ["GET", "/admin/reports/sales"],
    ["POST", "/admin/returns"],
    ["GET", "/admin/a-route-nobody-listed"],
    ["POST", "/admin/platform-settings/returns"],
    ["GET", "/admin/platform-settings/bank_transfer"],
  ])("refuses %s %s", (method, path) => {
    expect(allowed(method, path)).toBe(false)
  })

  it("reads customers a page at a time (security review L3)", () => {
    expect(decideSupport("GET", "/admin/customers", { pageSize: 50 }).allowed).toBe(true)
    expect(decideSupport("GET", "/admin/customers", {}).allowed).toBe(true)
    expect(decideSupport("GET", "/admin/customers", { pageSize: 51 }).allowed).toBe(false)
    expect(decideSupport("GET", "/admin/customers", { pageSize: Number.NaN }).allowed).toBe(false)
  })

  it("starts only the jobs on its list: exports of customers and orders are refused", () => {
    expect(allowed("POST", "/admin/async-jobs", "catalog.import")).toBe(true)
    expect(allowed("POST", "/admin/async-jobs", "catalog.export")).toBe(true)
    expect(allowed("POST", "/admin/async-jobs", "customer.export")).toBe(false)
    expect(allowed("POST", "/admin/async-jobs", "order.export")).toBe(false)
    expect(allowed("POST", "/admin/async-jobs", "report.export")).toBe(false)
    expect(allowed("POST", "/admin/async-jobs", "a.new_kind")).toBe(false)
    expect(allowed("POST", "/admin/async-jobs")).toBe(false)
  })

  it("reaches only signing out under /auth: no token, 2FA or password change", () => {
    expect(allowed("DELETE", "/auth/session")).toBe(true)
    expect(allowed("POST", "/auth/token/refresh")).toBe(false)
    expect(allowed("POST", "/auth/session")).toBe(false)
    expect(allowed("POST", "/auth/mfa/factors")).toBe(false)
    expect(allowed("POST", "/auth/user/emailpass/update")).toBe(false)
  })

  it("offers the panel the same answers", () => {
    const can = supportCapabilities()
    expect(can.catalog).toBe(true)
    expect(can.looks).toBe(true)
    expect(can.settings).toBe(false)
    expect(can.staff).toBe(false)
    expect(can.team).toBe(false)
    expect(can.accounts).toBe(false)
    expect(can.security).toBe(false)
    expect(can.orderExport).toBe(false)
    expect(can.customerExport).toBe(false)
    expect(can.taxId).toBe(false)
    expect(can.audit).toBe(false)
    expect(can.migration).toBe(false)
  })
})

describe("every owner-only and private route is decided for support (security review M1)", () => {
  // Reached on purpose: the looks and samples (the session's work), what admins read anyway
  const REACHED = [
    "/admin/storefront-designs*",
    "/admin/storefront-presets*",
    "/admin/sample-catalog*",
    "/admin/ai/suggestions",
    "/admin/ai/seo-fill*",
  ]
  const sample = (path: string) => path.replace(/\*$/, "").replace(/:(\w+)/g, "x_1")
  const rules = [...OWNER_ONLY, ...PRIVATE].filter((rule) => !REACHED.includes(rule.path))

  it.each(rules.map((rule) => [rule.path, rule]))("refuses %s", (_path, rule) => {
    const method = rule.methods === "*" ? "POST" : (rule.methods[0] ?? "POST")
    expect(decideSupport(method, sample(rule.path), { apiKeyType: "secret" }).allowed).toBe(false)
  })
})
