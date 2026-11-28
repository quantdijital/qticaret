import { checkUsageReport } from "../usage-rules"

const TENANT = "ten_01JCP0TEST0000000000000000"
const NOW = new Date("2026-11-11T09:00:00.000Z")

const report = (changes: Record<string, unknown> = {}) => ({
  version: 1,
  tenant_id: TENANT,
  reported_at: NOW.toISOString(),
  period: "2026-11",
  counts: {
    products: 3,
    orders_this_month: 1,
    staff: 2,
    storage_mb: 10,
    llm_credits_this_month: 0,
  },
  last_order_at: "2026-11-10T08:00:00.000Z",
  release: { version: "1.0.0", commit: "abcdef0" },
  ...changes,
})

const check = (body: unknown, tenant = TENANT, now = NOW) =>
  checkUsageReport(typeof body === "string" ? body : JSON.stringify(body), tenant, now)

describe("checkUsageReport (adr/0061 §3.1, §5.4, Ek C13)", () => {
  it("takes the contract's report from its own shop, now", () => {
    expect(check(report())).toEqual({ ok: true, report: report() })
    // Within the signed request's window either side
    expect(check(report(), TENANT, new Date(NOW.getTime() + 299_000)).ok).toBe(true)
    expect(check(report(), TENANT, new Date(NOW.getTime() - 299_000)).ok).toBe(true)
  })

  it.each([
    ["not JSON", "{"],
    ["an unknown top-level field", report({ revenue: 125_000 })],
    ["an unknown count", report({ counts: { ...report().counts, customers: 4 } })],
    ["a customer's e-mail", report({ email: "ayse@example.com" })],
    ["another version", report({ version: 2 })],
    ["a fraction", report({ counts: { ...report().counts, staff: 1.5 } })],
    // Review L1: past a database integer, a refusal rather than a failed insert
    ["a count too large", report({ counts: { ...report().counts, storage_mb: 2_147_483_648 } })],
  ])("refuses %s: 400 usage.invalid", (_case, body) => {
    expect(check(body)).toEqual({ ok: false, status: 400, message: "usage.invalid" })
  })

  const setup = {
    store_named: true,
    currency: true,
    region: true,
    stock_location: true,
    shipping: false,
    payment: false,
    product_published: true,
    look_published: false,
    legal_published: false,
    mail_sender: false,
  }

  it("takes a report with the setup checklist and one without (an older shop), Ek C21", () => {
    expect(check(report({ setup }))).toEqual({ ok: true, report: report({ setup }) })
    expect(check(report())).toEqual({ ok: true, report: report() })
  })

  it.each([
    ["a provider's name", { ...setup, payment: "paytr" }],
    ["a count", { ...setup, product_published: 4 }],
    ["an unknown step", { ...setup, owner_email: false }],
    ["a missing step", { ...setup, mail_sender: undefined }],
    ["not an object", "ready"],
  ])("refuses a setup with %s: 400 usage.invalid", (_case, value) => {
    expect(check(report({ setup: value }))).toEqual({
      ok: false,
      status: 400,
      message: "usage.invalid",
    })
  })

  it("refuses another shop's id: 403", () => {
    expect(check(report({ tenant_id: "ten_01JOTHER0000000000000000" }))).toEqual({
      ok: false,
      status: 403,
      message: "usage.wrong_tenant",
    })
  })

  it("refuses an old or a future report: 400 usage.stale", () => {
    for (const offset of [-6 * 60_000, 6 * 60_000]) {
      const at = new Date(NOW.getTime() + offset).toISOString()
      expect(check(report({ reported_at: at }))).toEqual({
        ok: false,
        status: 400,
        message: "usage.stale",
      })
    }
  })

  it("refuses a period that is not its time's, or a last order after it", () => {
    for (const body of [
      report({ period: "2026-10" }),
      report({ last_order_at: "2026-11-11T09:30:00.000Z" }),
    ]) {
      expect(check(body)).toEqual({ ok: false, status: 400, message: "usage.inconsistent" })
    }
  })
})
