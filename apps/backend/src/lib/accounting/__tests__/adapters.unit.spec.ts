import { fakeInvoicingAllowed } from "../../invoicing"
import { fakeAccountingAllowed } from "../adapters"

describe("the fake accounting and invoicing programs", () => {
  it.each(["development", "staging", "production", undefined] as const)(
    "are never offered outside tests (%s): a shop owner trying the panel sees real programs only",
    (env) => {
      expect(fakeAccountingAllowed({ NODE_ENV: env })).toBe(false)
      expect(fakeInvoicingAllowed({ NODE_ENV: env })).toBe(false)
    }
  )

  it("are there for the tests", () => {
    expect(fakeAccountingAllowed({ NODE_ENV: "test" })).toBe(true)
    expect(fakeInvoicingAllowed({ NODE_ENV: "test" })).toBe(true)
  })
})
