import { JOB_TYPE_KEYS, exclusiveTypes, jobType, queueLockKey } from "../types"

// The audit reads redirects, and the publish gate (an import's, a bulk
// edit's) assesses products, through module links, which need a running
// app to define; the registry's own facts do not
jest.mock("../../seo/audit", () => ({ runSeoAudit: jest.fn() }))
jest.mock("../../seo/advisor/publish-gate", () => ({ publishGate: jest.fn() }))

describe("job types", () => {
  it("knows its types by own key only", () => {
    expect(JOB_TYPE_KEYS).toEqual([
      "audit_log.export",
      "catalog.bulk_edit",
      "catalog.export",
      "catalog.import",
      "promotion.codes",
      "seo.audit",
      "seo.sitemap",
      "seo.url_style",
    ])
    expect(jobType("__proto__")).toBeUndefined()
    expect(jobType("constructor")).toBeUndefined()
  })

  it("marks the audit log export as a single, personal data job kept 7 days", () => {
    expect(jobType("audit_log.export")).toMatchObject({
      singleton: true,
      containsPersonalData: true,
      resultTtlDays: 7,
    })
  })

  it("moves URL styles one run at a time, with nothing personal", () => {
    const type = jobType("seo.url_style")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false })
    expect(
      type?.input.safeParse({ product: "flat", category: "prefixed", brand: "prefixed" }).success
    ).toBe(true)
    expect(type?.input.safeParse({ product: "short" }).success).toBe(false)
  })

  it("audits the store one run at a time, keeping its report a month", () => {
    const type = jobType("seo.audit")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false, resultTtlDays: 30 })
    expect(type?.input.safeParse({ deep: true }).success).toBe(false)
  })

  it("edits products in bulk one run at a time, through the generic jobs route", () => {
    const type = jobType("catalog.bulk_edit")
    expect(type).toMatchObject({ singleton: true, containsPersonalData: false, resultTtlDays: 7 })
    expect(type?.internal).toBeUndefined()
    // Never beside an import: both write products
    expect(exclusiveTypes("catalog.bulk_edit")).toEqual(["catalog.bulk_edit", "catalog.import"])
    expect(queueLockKey("catalog.import")).toBe(queueLockKey("catalog.bulk_edit"))
    expect(exclusiveTypes("seo.audit")).toEqual(["seo.audit"])
    expect(
      type?.input.safeParse({
        product_ids: ["prod_1"],
        change: { action: "price", mode: "percent", value: 10 },
      }).success
    ).toBe(true)
  })

  it.each([
    [{}, true],
    [{ kind: "mutation", created_after: "2026-10-01T00:00:00.000Z" }, true],
    [{ kind: "everything" }, false],
    [{ created_after: "yesterday" }, false],
    [{ ip: "203.0.113.7" }, false],
  ])("checks export filters %p", (input, valid) => {
    expect(jobType("audit_log.export")?.input.safeParse(input).success).toBe(valid)
  })
})
