import { locksBilling } from "../billing-lock"

describe("locksBilling", () => {
  it("keeps the billing address once the invoice is issuing or issued", () => {
    expect(locksBilling({ status: "issuing" })).toBe(true)
    expect(locksBilling({ status: "issued" })).toBe(true)
  })

  it("lets an untouched pending or failed invoice take the new address", () => {
    const untouched = { listed_at: null, reported_at: null, external_id: null, job_id: null }
    expect(locksBilling({ status: "pending", ...untouched })).toBe(false)
    expect(locksBilling({ status: "failed", ...untouched, document_id: null })).toBe(false)
  })

  it("keeps it once the provider holds the draft, though the row still waits", () => {
    expect(locksBilling({ status: "pending", listed_at: new Date() })).toBe(true)
    expect(locksBilling({ status: "pending", reported_at: new Date() })).toBe(true)
    expect(locksBilling({ status: "pending", external_id: "123" })).toBe(true)
    expect(locksBilling({ status: "failed", job_id: "job" })).toBe(true)
    expect(locksBilling({ status: "failed", document_id: "doc" })).toBe(true)
  })

  it("lets a cancelled or waived invoice go", () => {
    expect(locksBilling({ status: "cancelled", external_id: "123" })).toBe(false)
    expect(locksBilling({ status: "waived" })).toBe(false)
  })
})
