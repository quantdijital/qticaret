import { JOB_TYPE_KEYS, jobType } from "../types"

describe("job types", () => {
  it("knows its types by own key only", () => {
    expect(JOB_TYPE_KEYS).toEqual(["audit_log.export", "seo.url_style"])
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
