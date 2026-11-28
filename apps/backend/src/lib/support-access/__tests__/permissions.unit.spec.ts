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
    expect(allowed("POST", "/admin/platform-settings/store")).toBe(true)
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
  ])("refuses %s %s", (method, path) => {
    expect(allowed(method, path)).toBe(false)
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
    expect(can.settings).toBe(true)
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
